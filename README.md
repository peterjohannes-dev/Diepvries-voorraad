# 🧊 Diepvries Voorraad

Een simpele webapp om de inhoud van je diepvries bij te houden.

## Functies

- Producten toevoegen, bewerken en verwijderen
- Zoeken en filteren op categorie
- Houdbaarheidsdatum bijhouden met waarschuwingen
- Statistieken dashboard
- Beveiligd met pincode

## Installatie

```bash
npm install
```

## Starten

```bash
npm start
```

De app draait standaard op `http://localhost:3000`.

## Configuratie

Via omgevingsvariabelen:

| Variabele | Standaard | Beschrijving |
|-----------|-----------|--------------|
| `PORT` | `3000` | Server poort |
| `PIN` | `1234` | Inlogpincode |
| `SESSION_SECRET` | (ingebouwd) | Sessie encryptie |

Voorbeeld:

```bash
PIN=5678 npm start
```
