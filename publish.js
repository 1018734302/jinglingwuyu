const { execFileSync, spawnSync } = require('child_process');
const root = __dirname;
const env = Object.assign({}, process.env, {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'Never'
});

function credential() {
  const out = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8', env, timeout: 15000
  });
  const obj = {};
  out.split(/\r?\n/).forEach(function (line) {
    const i = line.indexOf('=');
    if (i > 0) obj[line.slice(0, i)] = line.slice(i + 1);
  });
  return obj;
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env, timeout: 120000 });
  if (r.status !== 0) {
    throw new Error('git ' + args.join(' ') + ' -> ' + (r.stderr || r.stdout || '').slice(0, 800));
  }
  return (r.stdout || '').trim();
}

async function main() {
  const c = credential();
  if (!c.password) throw new Error('NO_CREDENTIAL');
  const headers = {
    'Authorization': 'Bearer ' + c.password,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'jinglingwuyu-publish',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) throw new Error('AUTH_FAILED_HTTP_' + userRes.status);
  const user = await userRes.json();
  const login = user.login;
  console.log('github user = ' + login);

  const repoUrl = 'https://github.com/' + login + '/jinglingwuyu.git';
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: 'jinglingwuyu',
      description: '精灵勇者物语 · 单文件网页横版动作 RPG（HTML5 Canvas，零依赖）',
      private: false, has_issues: true, has_projects: false, has_wiki: false, auto_init: false
    })
  });
  if (createRes.status === 201) {
    console.log('repo created');
  } else if (createRes.status === 422) {
    const txt = await createRes.text();
    if (txt.indexOf('already exists') === -1) throw new Error('CREATE_FAILED ' + txt.slice(0, 200));
    console.log('repo already exists, reuse');
  } else {
    throw new Error('CREATE_FAILED_HTTP_' + createRes.status + ' ' + (await createRes.text()).slice(0, 200));
  }

  const status = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf8' });
  if (status.status !== 0) git(['init', '-b', 'main']);
  else git(['branch', '-M', 'main']);

  git(['add', '-A']);
  const staged = git(['diff', '--cached', '--name-only']);
  console.log('staged files:\n' + staged);
  if (!staged) throw new Error('NOTHING_TO_COMMIT');

  const hasCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).status === 0;
  if (!hasCommit) {
    git(['commit', '-m', 'feat: 精灵勇者物语 单文件网页横版动作 RPG']);
    console.log('commit created');
  } else console.log('commit already exists');

  const remotes = git(['remote']);
  if (remotes.split(/\r?\n/).indexOf('origin') === -1) git(['remote', 'add', 'origin', repoUrl]);
  else git(['remote', 'set-url', 'origin', repoUrl]);

  git(['push', '-u', 'origin', 'main']);
  console.log('push success');
  console.log('REPO_URL = https://github.com/' + login + '/jinglingwuyu');
}

main().catch(function (e) {
  console.log('FAILED: ' + e.message);
  process.exitCode = 1;
});
