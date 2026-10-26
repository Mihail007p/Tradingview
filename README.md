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

- `CLOUDFLARE_API_TOKEN` — токен Cloudflare с правом редактировать Workers Scripts.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID. Можно задать его как repository variable с таким же именем.
- `ACCESS_KEY` — придумайте длинную случайную фразу. Это пароль, который вы будете вводить на странице чата; это **не** Cloudflare API-токен.

После добавления секретов успешный push/merge в `main` запустит workflow `Deploy AI chat to Cloudflare`. Он публикует страницу на адрес вида `https://chart-analyst-bot.<ваш-workers.dev-домен>` и загружает `ACCESS_KEY` в Worker как secret. Точный URL появится в логе шага `Deploy Worker and static site` в Actions и в Cloudflare Dashboard → Workers & Pages → `chart-analyst-bot`.

Workflow читает `CLOUDFLARE_ACCOUNT_ID` сначала из Secrets, затем из Variables. Если `ACCESS_KEY` отсутствует, сайт развернётся, но API чата останется закрытым — добавьте секрет и запустите деплой снова.

OpenCode запускается, если `/opencode` есть в новом комментарии, в описании нового Issue от владельца или в ручном запуске через **Actions → opencode → Run workflow**. Автоматические запуски ограничены аккаунтом `Mihail007p`.

Cloudflare AI binding задаётся в `wrangler.toml`; ключ провайдера не требуется передавать браузеру. В аккаунте должна быть включена Workers AI и доступна выбранная модель.

## Проверки и локальный запуск

```sh
npm test
npx wrangler@4 dev
```

Для реальных запросов к Workers AI локальный Wrangler должен быть авторизован в вашем Cloudflare аккаунте; не помещайте токены в клиентский код.
