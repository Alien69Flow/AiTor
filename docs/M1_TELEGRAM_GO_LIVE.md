# M1 — Telegram + AI production checklist

## Publicly verified on 19 August 2026

- `https://aitor.alienflow.space/` responds successfully.
- `GET https://aitor.alienflow.space/api/telegram-webhook` returns `405 Method Not Allowed`, which confirms that a POST-only webhook endpoint is deployed.
- `https://t.me/Alien69Bot` and `https://t.me/Alien69Bot/app` are publicly reachable.
- The code routes ordinary Telegram messages to the AiTor chat function and routes `/manus` tasks to the Manus callback flow.

These checks prove that the public routes exist. They do not prove that private production credentials, webhook registration, model provider credits or payment rules are currently valid.

## Owner activation steps

1. In the production host, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `MANUS_API_KEY` and `MANUS_WEBHOOK_SECRET` using the host's encrypted environment-variable panel.
2. Deploy the branch containing this checklist and the strict webhook-secret check.
3. Register the Telegram webhook using the same `TELEGRAM_WEBHOOK_SECRET`:

   ```bash
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://aitor.alienflow.space/api/telegram-webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message"]'
   ```

4. Set `TELEGRAM_MINI_APP_URL` to the public HTTPS URL of the AiTor Mini App (default: `https://aitor.alienflow.space`). The `/app` command sends a direct Telegram Web App button, so it does not depend on an unregistered BotFather short name such as `/app`.
5. In BotFather, configure group privacy according to the intended community behaviour.
6. Test from a real Telegram account:
   - `/start` returns the welcome message;
   - a normal message receives an AI response;
   - `/app` opens the Mini App;
   - `/manus <question>` receives its asynchronous callback;
   - an invalid webhook request is rejected with `401`.
7. Check the hosting logs and Telegram's `getWebhookInfo` after the test. Pending updates and last webhook errors must be zero.

## Monetization boundary

M1 can link Telegram to the same verified-access backend, but payment activation remains disabled until the NFT contracts, payment recipient, accepted asset and pricing rules are confirmed by the owner.
