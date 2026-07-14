# THIS IS ME? — v5

Opera web interattiva.

## Flusso
1. Ricerca per nome.
2. Un risultato alla volta, nello stesso ordine di pertinenza restituito dal motore.
3. Tre tentativi di riconoscimento.
4. Se nessun risultato è corretto: webcam oppure caricamento di una fotografia.
5. La fotografia scelta innesca una seconda ricerca narrativa di contenuti associati.
6. Sequenza “Analysing identity”.
7. Cancellazione interattiva del ritratto.
8. Emersione della mappa cognitiva.
9. Finale “THIS IS ALSO ME”.

## Nota sulla seconda ricerca
Nel prototipo la seconda ricerca è una simulazione dichiarata di associazioni e inferenze.
Per collegarla a una vera ricerca inversa servono un provider autorizzato, una API e una funzione server sicura.

## Avvio
Per la webcam serve HTTPS oppure localhost.

```bash
python3 -m http.server 8000
```

Poi aprire: http://localhost:8000
