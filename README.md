# Luma — личный ИИ-чат

Небольшой русскоязычный веб-чат на Cloudflare Workers AI. Интерфейс и API работают из одного Cloudflare Worker; API-токен Cloudflare не отправляется в браузер.

## Что используется

- Cloudflare Workers Static Assets для страницы чата.
- Workers AI binding (`AI`) для модели `@cf/qwen/qwen3.8-27b`.
- Защита чата личным ключом: серверный секрет `ACCESS_KEY`.
- GitHub Actions для тестов и деплоя.

## Настройка GitHub

Откройте `Settings → Secrets and variables → Actions` и добавьте:

**Repository secrets**

- `CLOUDFLARE_API_TOKEN` — отдельный Cloudflare API Token с разрешением **Account → Workers Scripts → Edit**. `CLOUDFLARE_API_KEY` для OpenCode не заменяет этот токен деплоя.
- `CLOUDFLARE_ACCOUNT_ID` — реальный Cloudflare Account ID. Можно задать как Secret или Actions Variable.
- `ACCESS_KEY` — придумайте длинную случайную фразу. Это пароль для входа на сайт чата, не Cloudflare API-токен.

После добавления секретов успешный push/merge в `main` запустит workflow `Deploy AI chat to Cloudflare`. Он публикует страницу на адрес вида `https://chart-analyst-bot.<ваш-workers.dev-домен>` и загружает `ACCESS_KEY` в Worker как secret. Точный URL появится в логе шага `Deploy Worker and static site` в Actions и в Cloudflare Dashboard → Workers & Pages → `chart-analyst-bot`.

Workflow проверяет все три значения до деплоя и завершится с понятной ошибкой, если какое-либо отсутствует. `CLOUDFLARE_ACCOUNT_ID` читается сначала из Secrets, затем из Variables. После успешного деплоя URL будет в логе Actions и в Cloudflare Dashboard.

OpenCode запускается, если `/opencode` есть в новом комментарии, в описании нового Issue от владельца или в ручном запуске через **Actions → opencode → Run workflow**. Автоматические запуски ограничены аккаунтом `Mihail007p`.

Cloudflare AI binding задаётся в `wrangler.toml`; ключ провайдера не требуется передавать браузеру. В аккаунте должна быть включена Workers AI и доступна выбранная модель.

## Запуск OpenCode с телефона

1. Сначала добавьте реальные Cloudflare credentials в `Settings → Secrets and variables → Actions`:
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID (Secret или Variable).
   - `CLOUDFLARE_API_KEY` — Workers AI API token (Secret). Если уже настроен `CLOUDFLARE_API_TOKEN`, workflow также попробует его.
2. Откройте [форму задания OpenCode](https://github.com/Mihail007p/Tradingview/issues/new?template=opencode.yml), введите задачу и нажмите **Submit new issue**.
3. Workflow стартует автоматически; смотрите результат во вкладке **Actions**. После выполнения агент ответит в Issue и, если нужно, откроет PR.

Также можно оставить `/opencode ...` отдельным комментарием к Issue либо запустить workflow вручную в **Actions → opencode → Run workflow**. Все автоматические запуски из Issue ограничены аккаунтом `Mihail007p`.

## Проверки и локальный запуск

```sh
npm test
npx wrangler@4 dev
```

Для реальных запросов к Workers AI локальный Wrangler должен быть авторизован в вашем Cloudflare аккаунте; не помещайте токены в клиентский код.
