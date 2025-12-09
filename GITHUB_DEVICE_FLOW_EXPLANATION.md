# GitHub Device Flow - Förklaring

## ❓ Vad är Device Flow?

**Device Flow** är en OAuth 2.0-autentiseringsmetod som är designad för enheter som:
- Saknar webbläsare (smart-TV, IoT-enheter, etc.)
- Har begränsad input-möjlighet (konsoler, smart speakers)
- Behöver användaren autentisera sig på en annan enhet

## 🔄 Hur fungerar Device Flow?

1. Enheten visar en kod (t.ex. `ABCD-1234`)
2. Användaren går till en webbsida på sin telefon/dator
3. Användaren anger koden
4. Enheten får access token

## ❌ Behöver vi Device Flow?

**NEJ!** Du behöver INTE aktivera Device Flow för vår applikation.

### Varför?
- Vår applikation är en **webapplikation** med full webbläsare
- Vi använder standard **Authorization Code Flow** (den vanliga OAuth-flödet)
- Device Flow är endast för specialfall med enheter utan webbläsare

### Vad använder vi istället?
**Authorization Code Flow:**
1. Användare klickar "Connect GitHub" på integrations-sidan
2. Redirectas till GitHub för autentisering
3. GitHub redirectar tillbaka till vår callback URL
4. Vi får access token

Detta är standard och fungerar perfekt för webapplikationer.

## ✅ Rekommendation

**Lämna "Enable Device Flow" AVSTÄNGT** när du skapar GitHub OAuth App.

Detta påverkar INTE funktionaliteten - vår app använder ändå inte Device Flow.

## 📚 Mer Information

- **GitHub Device Flow Docs:** https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
- **OAuth 2.0 Device Flow Spec:** https://oauth.net/2/device-flow/

