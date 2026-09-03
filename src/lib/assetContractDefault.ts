// A kihelyezett eszközök német alap-szerződéssablonja (Leihvertrag). Az üres
// sablon-táblát a GET /api/asset-contract-template ezzel tölti fel először.
// A {{...}} tokeneket a generálás tölti ki a partner adataival és a tételekkel.

export const CONTRACT_TOKENS: Array<{ token: string; label: string }> = [
  { token: '{{Firmenname}}',      label: 'A partner cégneve' },
  { token: '{{Adresse}}',         label: 'Utca, házszám' },
  { token: '{{PLZ}}',             label: 'Irányítószám' },
  { token: '{{Ort}}',             label: 'Város' },
  { token: '{{Land}}',            label: 'Ország' },
  { token: '{{Ansprechpartner}}', label: 'Kapcsolattartó neve' },
  { token: '{{USt_IdNr}}',        label: 'Adószám (USt-IdNr.)' },
  { token: '{{Geräteliste}}',     label: 'A kipipált eszközök/alkatrészek táblázata' },
  { token: '{{Gesamtwert}}',      label: 'Az átadott eszközök összértéke €' },
  { token: '{{Übergabedatum}}',   label: 'Az átadás dátuma' },
  { token: '{{Übergeben_durch}}', label: 'Ki adta ki (a megerősítő ember)' },
  { token: '{{Vertragsnummer}}',  label: 'A szerződés sorszáma' },
]

export const DEFAULT_CONTRACT_TITLE = 'Leihvertrag'

export const DEFAULT_CONTRACT_BODY = `LEIHVERTRAG
über die Überlassung von Präsentationsmaterial

zwischen

Memini Design
[Anschrift des Verleihers hier eintragen]
– nachfolgend „Verleiher" –

und

{{Firmenname}}
{{Adresse}}
{{PLZ}} {{Ort}}
{{Land}}
USt-IdNr.: {{USt_IdNr}}
Ansprechpartner: {{Ansprechpartner}}
– nachfolgend „Entleiher" –

Vertragsnummer: {{Vertragsnummer}}


§ 1 Überlassene Gegenstände
Der Verleiher überlässt dem Entleiher die folgenden Gegenstände unentgeltlich zur Nutzung für die Präsentation und den Verkauf von Memini-Produkten:

{{Geräteliste}}

Gesamtwert der überlassenen Gegenstände: {{Gesamtwert}}
Übergabedatum: {{Übergabedatum}}
Übergeben durch: {{Übergeben_durch}}


§ 2 Eigentum
Die überlassenen Gegenstände bleiben jederzeit Eigentum des Verleihers. Der Entleiher erwirbt weder Eigentum noch sonstige Rechte an ihnen.

§ 3 Nutzung und Sorgfaltspflicht
Der Entleiher behandelt die Gegenstände pfleglich, verwendet sie ausschließlich bestimmungsgemäß und schützt sie vor Beschädigung, Verlust und Diebstahl. Eine Weitergabe an Dritte ist nicht gestattet.

§ 4 Rückgabe
Der Entleiher gibt die Gegenstände auf Anforderung des Verleihers oder bei Beendigung der Geschäftsbeziehung vollständig und in ordnungsgemäßem Zustand zurück.

§ 5 Haftung bei Verlust oder Beschädigung
Bei Verlust oder nicht nur unerheblicher Beschädigung eines überlassenen Gegenstandes ersetzt der Entleiher dem Verleiher den oben ausgewiesenen Wert des betreffenden Gegenstandes.

§ 6 Schlussbestimmungen
Änderungen und Ergänzungen dieses Vertrages bedürfen der Textform. Es gilt deutsches Recht.


Ort, Datum: __________________________


_______________________________        _______________________________
Verleiher (Memini Design)               Entleiher ({{Firmenname}})
`
