# Daily Rates Tracker

Daily EUR exchange-rate history from [ExchangeRate-API](https://www.exchangerate-api.com).
Requires Node.js 22+ and Git; no npm dependencies. The chart reads `data/rates.json`.

## Local verification

```sh
npm test
npm run automation:dry-run
```

Dry run requests the real API and reports whether new data exists, without writing,
pulling, committing or pushing. `npm run automation` is the live command: it requires
a clean `main` checkout, pulls with `--ff-only`, fetches and validates rates, atomically
appends a new provider date, commits only `data/rates.json`, then pushes to `main`.
Existing dates are left unchanged. By default no empty commits are generated. Optional `--heartbeat` creates an explicitly
labelled empty scheduler commit when the API has no new date; API errors still fail
without creating a commit.
Errors exit nonzero and include timestamps. Requests time out after 30 seconds;
Git commands time out after two minutes. An exclusive lock prevents overlapping runs.
A failed push is retried on the next run if the checkout is clean and histories have
not diverged. Resolve divergent history manually; automation never force-pushes.

## Ubuntu deployment (Linux user `filip`)

Install Node.js 22+ and Git, then verify `node --version` and `command -v node`.
Use a dedicated writable clone owned by `filip`; do not run the job as root.
Publish the local implementation to GitHub before cloning/pulling on the server.

As `filip`, generate a dedicated repository key (do not overwrite an existing key):

```sh
ssh-keygen -t ed25519 -f ~/.ssh/daily_rates_deploy -C daily-rates-automation
cat ~/.ssh/daily_rates_deploy.pub
```

Add the public key to the repository's GitHub **Settings → Deploy keys**, enabling
**Allow write access**. Keep the private key on the server. Add to `~/.ssh/config`:

```sshconfig
Host github-daily-rates
  HostName github.com
  User git
  IdentityFile ~/.ssh/daily_rates_deploy
  IdentitiesOnly yes
  BatchMode yes
```

Connect once interactively and verify GitHub's host key before accepting it:
`ssh -T git@github-daily-rates` (GitHub can return exit code 1 even after authentication).
Then replace OWNER and REPOSITORY below with the actual repository values:

```sh
mkdir -p ~/apps ~/logs
cd ~/apps
git clone git@github-daily-rates:OWNER/REPOSITORY.git daily-rates-tracker
cd daily-rates-tracker
git config user.name "daily-rates-automation"
git config user.email "YOUR_AUTOMATION_EMAIL"
npm test
npm run automation:dry-run
npm run automation
```

Use an email you control. Commit subjects explicitly identify automated updates.
Repository branch rules must allow this deploy key to push to `main`.
If using the existing domain directory instead, make sure `filip` owns the clone,
and substitute that path in the cron command.

Run `crontab -e` as `filip` and add the following, adjusting `/usr/bin/node` to the
absolute path from `command -v node` (and PATH if Git is elsewhere):

```cron
PATH=/usr/local/bin:/usr/bin:/bin
17 8 * * * cd /home/filip/apps/daily-rates-tracker && /usr/bin/node automation/runner.js >> /home/filip/logs/daily-rates.log 2>&1
```

Cron runs at **08:17 in the server timezone**. Check `timedatectl` and `crontab -l`.
The machine must stay on; your MacBook need not be on. Check logs with
`tail -n 100 ~/logs/daily-rates.log` and configure log rotation for long-term use.
A force-killed job may leave `.git/daily-rates.lock`; remove that empty directory
only after confirming no runner is active. A fetch followed by failed commit can
leave modified data: inspect it, fix the Git identity/error, then commit or restore
that file before retrying. Never discard unrelated work to clear this check.

## GitHub Actions

The workflow is **manual only** to avoid a second daily scheduler. It is a fallback;
do not start it while the Ubuntu job is running. It uses the GitHub Actions bot
identity. The server and workflow both use the same runner and tests.

## Short cron test

After publishing these changes and pulling them into the clean server clone, use
`crontab -e` as `filip` to run every five minutes:

```cron
PATH=/usr/local/bin:/usr/bin:/bin
*/5 * * * * cd /home/filip/apps/daily-rates-tracker && /usr/bin/node automation/runner.js --heartbeat >> /home/filip/logs/daily-rates.log 2>&1
```

Keep only one cron entry for this project. With `--heartbeat`, unchanged rates create
an empty `chore: automated scheduler heartbeat ...` commit. New rates create the
normal automated data commit. This tests the scheduler and push without fabricating
rate changes. A successful API request is required in both cases.
Inspect `tail -n 100 ~/logs/daily-rates.log` and `git log -5 --oneline`.
After testing, replace the five-minute entry with the daily entry above; retain
`--heartbeat` only if you want an automated commit even on days with no new data.
The configured Git author determines attribution; an automation bot identity does
not demonstrate that you manually wrote code. These commits stay explicitly automated.
