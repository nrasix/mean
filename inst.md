# Настройка репозитория и CI

Эта инструкция — для владельца репозитория `nrasix/mean`. Она описывает, как залить проект на GitHub, включить проверки для pull request, настроить релизы, winget и (опционально) подпись Windows.

## 1. Что уже лежит в репозитории

| Файл | Назначение |
| --- | --- |
| `.github/workflows/ci.yml` | Проверки для каждого pull request |
| `.github/workflows/release.yml` | Сборка релиза по тегу `v*` и портативного Windows ZIP |
| `.github/workflows/winget.yml` | Публикация манифеста в `microsoft/winget-pkgs` после публикации релиза |
| `winget/manifests/...` | Манифест winget для `nrasix.Mean` |
| `install.ps1` | Установка последнего релиза одной командой |
| `docs/signpath-workflow.example.yml` | Шаблон подписи Windows через SignPath |

## 2. Первый push на GitHub

Создайте публичный репозиторий `mean` под аккаунтом `nrasix` (без README и лишних файлов), затем:

```bash
git remote add origin https://github.com/nrasix/mean.git
git add .
git commit -m "release: v1.0.0"
git push -u origin master
```

После первого push создайте pull request (можно из отдельной ветки в `master`). CI запускается только на `pull_request`, поэтому прямой push в `master` проверок не запускает.

## 3. Настройки GitHub Actions

1. **Settings → Actions → General → Actions permissions** — выберите *Allow all actions and reusable workflows*.
2. Там же, **Workflow permissions** — включите *Read and write permissions*. Это нужно workflow релиза, чтобы создавать GitHub Release и загружать артефакты.
3. Сохраните.

Публичные репозитории используют стандартные runners GitHub Actions **бесплатно и без лимита минут**. Лимит в 2000 минут/месяц относится к **приватным** репозиториям на бесплатном плане, причём Linux считается 1×, Windows 2×, macOS 10×. Для публичного репозитория платить за стандартные runners не нужно.

## 4. Защита ветки и обязательные проверки

1. **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `master`.
3. Включите:
   - **Require a pull request before merging**;
   - **Require status checks to pass before merging**;
   - **Require branches to be up to date before merging**.
4. В списке статусов выберите **Frontend** и **Rust** (они появляются после первого pull request и запуска CI).
5. При желании включите **Do not allow bypassing the above settings**.

Теперь прямой push в `master` будет запрещён, а PR нельзя будет смёржить с падающими проверками.

## 5. Что проверяет CI

Workflow `.github/workflows/ci.yml` запускается только на `pull_request`.

### Job Frontend

```bash
npm ci
npm run build        # tsc --noEmit + vite build
```

Ловит ошибки TypeScript и сборки Vite.

### Job Rust

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Ловит форматирование, предупреждения Clippy (как ошибки) и падения тестов. Сетевые live-тесты помечены `#[ignore]` и в CI не выполняются.

Те же команды можно запускать локально:

```bash
npm run build
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

## 6. Релиз v1.0.0

Версия уже выставлена в `package.json`, `src-tauri/Cargo.toml` и `src-tauri/tauri.conf.json`. Для нового релиза:

1. Обновите версию в этих трёх файлах.
2. Закоммитьте изменения.
3. Создайте и запушьте тег:

```bash
git tag v1.0.0
git push origin v1.0.0
```

`release.yml` соберёт:

- Windows `.msi` и NSIS `*-setup.exe`;
- macOS `.dmg` для Intel и Apple Silicon;
- Linux `.deb`, `.rpm`, `.AppImage`;
- портативный `*-windows-x64-portable.zip`.

Релиз создаётся как **draft**. Проверьте артефакты в GitHub и нажмите **Publish release**. После публикации запускается `winget.yml`.

## 7. Публикация в winget

Понадобится классический personal access token (PAT) GitHub:

1. **Settings (личного аккаунта) → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**.
2. Scope: `public_repo` (или `repo`).
3. Скопируйте токен.
4. В репозитории: **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `WINGET_TOKEN`
   - Value: токен.
5. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   - Name: `WINGET_ENABLED`
   - Value: `true`.

После публикации следующего релиза workflow `winget.yml` создаст fork `microsoft/winget-pkgs`, добавит манифест и откроет PR. Первый PR проходит модерацию вручную.

Проверить манифест локально (Windows, установленный winget):

```powershell
winget validate --manifest .\winget\manifests\n\nrasix\Mean\1.0.0
```

Установка из локального манифеста:

```powershell
winget install --manifest .\winget\manifests\n\nrasix\Mean\1.0.0
```

Важно: `InstallerSha256` в репозитории соответствует локально собранному установщику 1.0.0. CI собирает файл заново, поэтому хэш может отличаться. Для автоматической публикации `winget-releaser` сам считает SHA-256 из assets опубликованного релиза — вручную менять манифест не нужно.

## 8. Подпись Windows через SignPath (опционально)

1. Подайте заявку в [SignPath Foundation](https://signpath.org/) — для публичного OSS-проекта подпись бесплатна.
2. После одобрения создайте проект и signing policy в SignPath.
3. Скопируйте `docs/signpath-workflow.example.yml` в `.github/workflows/signpath.yml`.
4. Добавьте секрет `SIGNPATH_API_TOKEN`.
5. Добавьте переменные:
   - `SIGNPATH_ENABLED=true`
   - `SIGNPATH_ORGANIZATION_ID`
   - `SIGNPATH_PROJECT_SLUG`
   - `SIGNPATH_SIGNING_POLICY_SLUG`
   - `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`

Workflow скачает установщики из опубликованного релиза, отправит их на подпись и загрузит подписанные файлы обратно.

## 9. Переменные и секреты — сводка

| Имя | Тип | Обязательно | Назначение |
| --- | --- | --- | --- |
| `WINGET_TOKEN` | secret | для winget | PAT с доступом к `public_repo` |
| `WINGET_ENABLED` | variable | для winget | `true`, включает job публикации |
| `SIGNPATH_API_TOKEN` | secret | для подписи | API-токен SignPath |
| `SIGNPATH_ENABLED` | variable | для подписи | `true`, включает workflow |
| `SIGNPATH_ORGANIZATION_ID` | variable | для подписи | ID организации |
| `SIGNPATH_PROJECT_SLUG` | variable | для подписи | slug проекта |
| `SIGNPATH_SIGNING_POLICY_SLUG` | variable | для подписи | slug policy |
| `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | variable | для подписи | slug конфигурации артефактов |
| `GITHUB_TOKEN` | автоматический | всегда | создание релиза и загрузка артефактов |

## 10. Частые проблемы

- **CI падает на `cargo fmt`** — выполните `cargo fmt` и закоммитьте изменения.
- **CI падает на Clippy** — исправьте предупреждение, не отключайте проверку через `#[allow]` без причины.
- **Rust job падает на Linux из-за OpenSSL** — проверьте, что в workflow установлен `libssl-dev` и `pkg-config` (уже добавлено).
- **Release не создаётся** — проверьте, что тег начинается с `v` и в настройках Actions разрешены read/write permissions.
- **winget job пропущен** — не задана переменная `WINGET_ENABLED=true` или нет секрета `WINGET_TOKEN`.
- **SmartScreen всё ещё предупреждает** — сборка не подписана; см. раздел «SmartScreen и подпись кода» в README.
