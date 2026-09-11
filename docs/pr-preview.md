# Per-PR preview deployments

Opening a pull request brings that branch up as a bot in the private test guild.
Closing the pull request takes it down. The production bot, the production
command set, and the GitHub-hosted CI jobs are never touched.

Moving parts:

- `.github/workflows/pr-preview.yml` reacts to `pull_request` events.
- `scripts/preview.sh` builds, starts, lists, and stops the preview container.
- `scripts/pr-preview-comment.sh` keeps one status comment up to date on the PR.
- `docker-compose.preview.yml` defines the `pr-preview` service.

Everything except the self-hosted runner itself is reproducible from this
repository, which is why the runner setup is written down here.

## One-time runner setup

The runner lives on the desktop, because that is where the bot already runs and
where test guild access lives.

1. In GitHub, go to Settings > Actions > Runners > New self-hosted runner, pick
   Linux x64, and follow the download and configure steps on the desktop.
2. When `config.sh` asks for additional labels, add `rpgclub-desktop`. The
   workflow targets `[self-hosted, linux, rpgclub-desktop]`, so a runner without
   that label is never picked.
3. Install it as a service so it survives reboots:

```bash
sudo ./svc.sh install && sudo ./svc.sh start
```

4. Confirm the runner user can reach Docker without `sudo`:

```bash
docker ps
```

If that fails, add the runner user to the `docker` group and restart the
service. The workflow builds images and starts containers as that user.

5. Install the GitHub CLI on the host. `scripts/preview.sh reap` uses it, and the
   workflow's comment step relies on `gh` being on `PATH`.

## The runner-local env file

The dev bot token never passes through GitHub secrets. It lives in one file on
the desktop, readable only by the runner user:

```bash
install -m 600 /dev/null ~/.config/rpgclub-bot/preview.env
```

Contents: the same variables the production `.env` carries, but pointed at
throwaway or staging values, with `BOT_TOKEN` set to the dedicated dev bot
application's token. Never the production token. Do not put `TEST_GUILD_ID` in
it; the workflow supplies that so the compose file can refuse to start a preview
that would register commands globally.

Override the path with a repository variable named `PREVIEW_ENV_FILE` if the
file lives somewhere else.

## Repository variables

- `TEST_GUILD_ID` (required): snowflake of the private test guild. Its presence
  is what puts the bot in test mode and scopes commands to that guild.
- `PREVIEW_ENV_FILE` (optional): absolute path to the env file above. Defaults
  to `~/.config/rpgclub-bot/preview.env` on the runner.

Both are variables rather than secrets: neither is a credential, and the guild ID
is already in `src/config/testGuild.ts`.

## Fork pull requests

A self-hosted runner executing workflow code from a fork is a known escalation
path. Both preview jobs are skipped unless the head branch lives in this
repository, so a fork PR never reaches the desktop. Leave
Settings > Actions > General > "Require approval for all external contributors"
enabled as a second layer.

## One preview at a time

Two preview bots in the same guild both answer the same slash command, which
corrupts every observation made against them. The workflow uses a single global
concurrency group, and `preview.sh up` tears down whatever is running before it
starts anything, so the newest PR wins.

Closing an old PR cannot kill a newer preview: `preview.sh down <pr>` compares
the PR number against the running container's label and does nothing when they
disagree.

## Watchtower

`docker-compose.yml` runs Watchtower against `:latest` every 120 seconds. The
preview container carries `com.centurylinklabs.watchtower.enable=false`, so
Watchtower skips it. Do not remove that label, or a preview will be replaced with
production's image mid-test.

## Driving it by hand

From the repository checkout on the desktop:

```bash
./scripts/preview.sh list
```

```bash
TEST_GUILD_ID=<snowflake> PREVIEW_PR_NUMBER=123 ./scripts/preview.sh up
```

```bash
./scripts/preview.sh logs
```

```bash
./scripts/preview.sh down
```

## Reaping orphans

A failed teardown leaves a bot in the guild answering commands for code nobody
is reviewing. `preview.sh reap` reads the running container's PR label, asks
GitHub whether that PR is still open, and tears the preview down when it is not.
It does nothing while the PR is open, so it is safe to run on a timer. Add this
to the runner user's crontab, adjusting the checkout path:

```
*/15 * * * * cd ~/code/bot && ./scripts/preview.sh reap >> /tmp/preview-reap.log 2>&1
```
