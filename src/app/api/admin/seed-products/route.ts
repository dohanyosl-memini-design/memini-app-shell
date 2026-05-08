import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PRODUCTS = [
  // ── ULM ──
  { sku: 'ULM-01', name: '(GO) Münster szökőkutas', nameDE: '(GO) Münster mit Fontäne', city: 'Ulm' },
  { sku: 'ULM-02', name: '(GO) Dunapartos', nameDE: '(GO) Donauufer', city: 'Ulm' },
  { sku: 'ULM-03', name: '(GO) Városházás', nameDE: '(GO) Rathaus', city: 'Ulm' },
  { sku: 'ULM-04', name: '(AQ) Münster szökőkutas', nameDE: '(AQ) Münster mit Fontäne', city: 'Ulm' },
  { sku: 'ULM-05', name: '(AQ) Münster szökőkutas (ég nélkül)', nameDE: '(AQ) Münster mit Fontäne (ohne Himmel)', city: 'Ulm' },
  { sku: 'ULM-06', name: 'Einstein 3D', nameDE: 'Einstein 3D', city: 'Ulm' },
  { sku: 'ULM-07', name: 'Ulmi látkép', nameDE: 'UlmSkyline', city: 'Ulm' },
  { sku: 'ULM-08', name: 'Einstein normál (NR)', nameDE: 'Einstein normal (NB)', city: 'Ulm' },
  { sku: 'ULM-09', name: 'Münster napos, álló', nameDE: 'Münster mit Sonne sR.', city: 'Ulm' },
  { sku: 'ULM-10', name: 'Münster napos, fekvő', nameDE: 'Münster mit Sonne lR.', city: 'Ulm' },
  { sku: 'ULM-11', name: 'Einstein-es, álló', nameDE: 'Einstein sR.', city: 'Ulm' },
  { sku: 'ULM-12', name: 'Einstein-es, fekvő', nameDE: 'Einstein lR.', city: 'Ulm' },
  { sku: 'ULM-13', name: '(GO) Ferdeházas', nameDE: '(GO) Schiefes Haus', city: 'Ulm' },
  { sku: 'ULM-14', name: '(GO) Münster sima, feliratos', nameDE: '(GO) Münster mit Benennung', city: 'Ulm' },
  { sku: 'ULM-15', name: '(AQ) Ferdeházas', nameDE: '(AQ) Schiefes Haus', city: 'Ulm' },
  { sku: 'ULM-16', name: '(AQ) Dunapartos', nameDE: '(AQ) Donauufer', city: 'Ulm' },
  { sku: 'ULM-17', name: 'Kulcstartófal minta', nameDE: 'Schlüsselanhängerwand', city: 'Ulm' },
  { sku: 'ULM-18', name: '(AQ) Veréb koszorúban', nameDE: '(AQ) Spatz im Kranz', city: 'Ulm' },
  { sku: 'ULM-19', name: '(AQ) Betlehemi jászol', nameDE: '(AQ) Die Krippe von Bethlehem', city: 'Ulm' },
  { sku: 'ULM-20', name: '(AQ) Ulmer Münster felirattal – karácsonyi vásár', nameDE: '(AQ) mit Ulmer Münster Aufschrift – Weihnachtsmarkt', city: 'Ulm' },
  { sku: 'ULM-21', name: '(AQ) Ulmer Weihnachtsmarkt felirattal – karácsonyi vásár', nameDE: '(AQ) mit Ulmer Weihnachtsmarkt Aufschrift – Weihnachtsmarkt', city: 'Ulm' },
  { sku: 'ULM-22', name: '(AQ) Téli Dunapart', nameDE: '(AQ) Donauufer im Winter', city: 'Ulm' },
  { sku: 'ULM-23', name: '(AQ) Ulmi Karácsony', nameDE: '(AQ) Ulmer Weihnachten', city: 'Ulm' },
  { sku: 'ULM-24', name: 'Bambusztoll minta (veréb fent a szövegen)', nameDE: 'Spatz über der Aufschrift', city: 'Ulm' },
  { sku: 'ULM-25', name: 'Bambusztoll minta (veréb a szöveg után)', nameDE: 'Spatz nach dem Aufschrift', city: 'Ulm' },
  { sku: 'ULM-26', name: 'Bambusztoll minta (Münster logóval)', nameDE: 'Münster eigenes Logo + Aufschrift', city: 'Ulm' },
  { sku: 'ULM-27', name: "Bambusztoll minta (Heidi's Lädle felirattal és verébbel)", nameDE: "Heidi's Lädle mit Aufschrift", city: 'Ulm' },
  { sku: 'ULM-28', name: 'Lézervágott hűtőmágnes: Veréb motívum – Ulmer Spatz felirattal', nameDE: 'Laserschnitt - Kühlschrankmagnet: Spatzenmotiv – Mit Ulmer Spatz-Aufschrift', city: 'Ulm' },
  { sku: 'ULM-29', name: '(AQ) Templomablak: Noé bárkája motívummal', nameDE: '(AQ) Kirchenfenster: Mit Noahs Arche-Motiv', city: 'Ulm' },
  { sku: 'ULM-30', name: 'Bambusztoll minta (Ulmi nyelvtörő, kis verébbel)', nameDE: 'Ulmer Zungenbrecher, mit Spatz (In Ulm, um Ulm und um Ulm herum...)', city: 'Ulm' },
  { sku: 'ULM-31', name: '(AQ) Berblinger torony', nameDE: '(AQ) Berblinger Turm', city: 'Ulm' },
  { sku: 'ULM-32', name: 'Lézervágott többrétegű ablak: Münster ablak', nameDE: 'Laserschnitt - Mehrschichtfenster: Münster-Fenster', city: 'Ulm' },
  { sku: 'ULM-33', name: 'Lézervágott többrétegű ablak: Münster ablak Chor 3', nameDE: 'Laserschnitt - Mehrschichtfenster: Münster-Fenster Chor 3', city: 'Ulm' },
  { sku: 'ULM-34', name: '(AQ) Einstein Rakétán', nameDE: '(AQ) Einstein nach Rakete', city: 'Ulm' },
  { sku: 'ULM-35', name: '(GO) Einsteins Museum', nameDE: '(GO) Einsteins Museum', city: 'Ulm' },
  { sku: 'ULM-36', name: '(BM) Bélyeg Hűtőmágnes (kétrétegű), Dunapart', nameDE: '(BM) Briefmarke Kühlschrankmagnet (zweischichtig), Donauufer', city: 'Ulm' },
  { sku: 'ULM-37', name: '(GO) Münster Verébbel (nagy)', nameDE: '(GO) Münster mit Spatz', city: 'Ulm' },
  { sku: 'ULM-38', name: '(BM) Bélyeg Hűtőmágnes (egyrétegű), Münster', nameDE: '(BM) Briefmarke Kühlschrankmagnet (einschichtig), Münster', city: 'Ulm' },
  { sku: 'ULM-39', name: '(GO) Ulmi Münster Stadthaus', nameDE: '(GO) Ulmer Münster mit Stadhaus', city: 'Ulm' },
  { sku: 'ULM-40', name: 'Mini magnet Spatz', nameDE: null, city: 'Ulm' },
  { sku: 'ULM-41', name: 'Mini magnet Drachen', nameDE: null, city: 'Ulm' },
  { sku: 'ULM-42', name: 'Eulen Affe', nameDE: 'Eulen Affe', city: 'Ulm' },
  { sku: 'ULM-43', name: 'Denevér', nameDE: 'Fledermaus', city: 'Ulm' },
  // ── BLAUBEUREN ──
  { sku: 'BLAUBEUREN-01', name: '(GO) Blautopf', nameDE: '(GO) Blautopf', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-02', name: '(AQ) Blautopf (miénk, templommal)', nameDE: '(AQ) Blautopf (unsere, mit Kirche)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-03', name: '(AQ) Blautopf (ég nélkül)', nameDE: '(AQ) Blautopf (ohne Himmel)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-04', name: '(AQ) Blautopf (KM)', nameDE: '(AQ) Blautopf (KM)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-05', name: '(AQ) Blautopf (ég nélkül) (KM)', nameDE: '(AQ) Blautopf (ohne Himmel) (KM)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-06', name: 'Blautopf nagybetűs (tó a templommal)', nameDE: 'Blautopf mit Buchstaben im großen Format (Blautopf mit Kirche)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-07', name: 'Blautopf bambusztoll', nameDE: 'Bambus-Kugelschreiber', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-08', name: '(AQ) Blautopf a malommal (miénk)', nameDE: '(AQ) Blautopf mit Hammerschmiede (unsere)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-09', name: 'Blautopf nagybetűs (Blautopf a malommal)', nameDE: 'Blautopf mit Buchstaben im großen Format (Blautopf mit Hammerschmiede)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-10', name: 'Ördöglakat-1 (Schöne Lau)', nameDE: 'Teufelsknoten-1 (Schöne Lau)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-11', name: '(AQ) Blautopf a malommal – színes faszelethez és kulcstartóhoz', nameDE: '(AQ) Blautopf mit Hammerschmiede (unsere) - zum bunte Holzscheibe und Schlüsselanhänger', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-12', name: 'Antik fatábla (Blautopf a malommal)', nameDE: 'Antikoptik-Holztafel (Blautopf mit Hammerschmiede)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-13', name: 'Ördöglakat-2 (Blautopf a malommal)', nameDE: 'Teufelsknoten-2 (Blautopf mit Hammerschmiede)', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-14', name: '(GO) Badhaus café & laden', nameDE: '(GO) Badhaus café & laden', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-15', name: 'Ördöglakat a mamuttal + felirat', nameDE: 'Teufelsknoten mit dem Mammut + Aufschrift', city: 'Blaubeuren' },
  { sku: 'BLAUBEUREN-16', name: 'Bambusztoll minta (Badhaus, café & laden felirattal)', nameDE: 'Bambus-Kugelschreiber: Mit der Aufschrift „Badhaus, café & laden"', city: 'Blaubeuren' },
  // ── BODENSEE ──
  { sku: 'BODENSEE-01', name: '(GO) Vitorlás a tavon', nameDE: '(GO) Segelboot auf dem See', city: 'Bodensee' },
  { sku: 'BODENSEE-02', name: '(AQ) Hajó a tavon', nameDE: '(AQ) Schiff auf dem See', city: 'Bodensee' },
  { sku: 'BODENSEE-03', name: 'Bodensee bambusztoll', nameDE: 'Bambus-Kugelschreiber', city: 'Bodensee' },
  { sku: 'BODENSEE-04', name: 'Ördöglakat-1', nameDE: 'Teufelsknoten-1', city: 'Bodensee' },
  { sku: 'BODENSEE-05', name: '(AQ) Hajó a tavon 2', nameDE: '(AQ) Schiff auf dem See 2', city: 'Bodensee' },
  // ── LINDAU ──
  { sku: 'LINDAU-01', name: '(GO) Kilátótorony hajóval', nameDE: '(GO) Aussichtsturm mit dem Schiff', city: 'Lindau' },
  { sku: 'LINDAU-02', name: '(AQ) Torony a kikötőben (V1)', nameDE: '(AQ) Turm im Hafen (V1)', city: 'Lindau' },
  { sku: 'LINDAU-03', name: '(AQ) Lindau-i sirály', nameDE: '(AQ) Lindauer Möwe', city: 'Lindau' },
  { sku: 'LINDAU-04', name: 'Lindau-i nagybetűs', nameDE: 'Lindau mit Buchstaben im großen Format', city: 'Lindau' },
  { sku: 'LINDAU-05', name: '(AQ) Lézervágott és UV nyomott kulcstartó: Torony a kikötőben', nameDE: '(AQ) Laserschnitt und UV-gedrückter Schlüsselanhänger: Turm im Hafen', city: 'Lindau' },
  { sku: 'LINDAU-06', name: '(AQ) Lindau-i látványosságok virágokkal', nameDE: '(AQ) Lindauer Sehenswürdigkeiten mit Blüten', city: 'Lindau' },
  { sku: 'LINDAU-07', name: '(AQ) Lindau-i világítótorony', nameDE: '(AQ) Lindauer Leuchtturm', city: 'Lindau' },
  // ── FÜSSEN ──
  { sku: 'FÜSSEN-01', name: '(GO) Neuschwansteini kastély', nameDE: '(GO) Schloss Neuschwanstein', city: 'Füssen' },
  { sku: 'FÜSSEN-02', name: '(AQ) Neuschwansteini kastély naplementével, fekvő', nameDE: '(AQ) S. Neuschwanstein bei Sonnenuntergang, liegend', city: 'Füssen' },
  { sku: 'FÜSSEN-03', name: '(AQ) Neuschwansteini kastély oldalról, álló', nameDE: '(AQ) S. Neuschwanstein von der Seite, stehend', city: 'Füssen' },
  { sku: 'FÜSSEN-04', name: '(AQ) Városlátkép Füssenről', nameDE: '(AQ) Stadtansicht von Füssen', city: 'Füssen' },
  { sku: 'FÜSSEN-05', name: 'Neuschwansteini nagybetűs', nameDE: 'S. Neuschwanstein mit Buchstaben im großen Format', city: 'Füssen' },
  { sku: 'FÜSSEN-06', name: 'Kulcstartó minta – Neuschwansteini kastély oldalról, álló', nameDE: 'Schlüsselanhängermotiv, S. Neuschwanstein von der Seite, stehend', city: 'Füssen' },
  { sku: 'FÜSSEN-07', name: 'Kulcstartó minta – Neuschwansteini kastély naplementével, fekvő', nameDE: 'Schlüsselanhängermotiv, S. Neuschwanstein bei Sonnenuntergang, liegend', city: 'Füssen' },
  { sku: 'FÜSSEN-08', name: 'Neuschwanstein bambusztoll', nameDE: 'Bambus-Kugelschreiber', city: 'Füssen' },
  { sku: 'FÜSSEN-09', name: 'Neuschwansteini ördöglakat', nameDE: 'Neuschwansteiner Teufelsknoten', city: 'Füssen' },
  { sku: 'FÜSSEN-10', name: '(AQ) Lechfall vízesés Füssenben', nameDE: '(AQ) Lechfall in Füssen', city: 'Füssen' },
  // ── ALLGÄU ──
  { sku: 'ALLGÄU-01', name: 'Allgäu-i tehenek nagybetűs', nameDE: 'Allgäuer Kühe mit Buchstaben im großen Format', city: 'Allgäu' },
  // ── TÜBINGEN ──
  { sku: 'TÜBINGEN-01', name: '(GO) Városlátkép a Neckarral', nameDE: '(GO) Stadtansicht mit dem Neckar', city: 'Tübingen' },
  { sku: 'TÜBINGEN-02', name: '(AQ) Neckar a híddal', nameDE: '(AQ) Der Neckar mit der Brücke', city: 'Tübingen' },
  { sku: 'TÜBINGEN-03', name: '(AQ) Virágok és a hajós', nameDE: '(AQ) Blumen und der Bootsmann', city: 'Tübingen' },
  { sku: 'TÜBINGEN-04', name: '(AQ) A Neckar és a tipikus házsor Tübingenben', nameDE: '(AQ) Der Neckar und die typische Häuserzeile in Tübingen', city: 'Tübingen' },
  { sku: 'TÜBINGEN-05', name: 'Tübingen-i nagybetűs', nameDE: 'Typische Tübinger Häuserzeile', city: 'Tübingen' },
  { sku: 'TÜBINGEN-06', name: '(AQ) Kulcstartó minta (Virágok és a hajós)', nameDE: '(AQ) Schlüsselanhänger Motiv (Blumen und der Bootsmann)', city: 'Tübingen' },
  { sku: 'TÜBINGEN-07', name: '(AQ) Antikoptik fatábla (A Neckar és a tipikus házsor Tübingenben)', nameDE: '(AQ) Antikoptik Holztafel (Der Neckar und die typische Häuserzeile in Tübingen)', city: 'Tübingen' },
  { sku: 'TÜBINGEN-08', name: 'Tübingeni bambusztoll', nameDE: 'Tübinger Bambus-Kugelschreiber', city: 'Tübingen' },
  { sku: 'TÜBINGEN-09', name: 'Lézervágott fa (épületek + Tübingen felirat)', nameDE: 'Lasergeschnittenes Holz (Gebäude + Tübinger Aufschrift)', city: 'Tübingen' },
  { sku: 'TÜBINGEN-10', name: 'Tübingeni ördöglakat', nameDE: 'Tübinger Teufelsknoten', city: 'Tübingen' },
  { sku: 'TÜBINGEN-11', name: '(AQ) Tübingen télies Neckarja', nameDE: '(AQ) Tübinger winterliche Neckar', city: 'Tübingen' },
  { sku: 'TÜBINGEN-12', name: '(AQ) Városháza karácsonykor', nameDE: '(AQ) Rathaus zu Weihnachten', city: 'Tübingen' },
  // ── MEERSBURG ──
  { sku: 'MEERSBURG-01', name: '(GO) Meersburgi kikötő sirályokkal', nameDE: '(GO) Meersburger Hafen mit Möwen', city: 'Meersburg' },
  { sku: 'MEERSBURG-02', name: '(AQ) Meersburg jellegzetes utcája', nameDE: '(AQ) Typischer Straßenzug in Meersburg', city: 'Meersburg' },
  { sku: 'MEERSBURG-03', name: '(AQ) Meersburg a várral', nameDE: '(AQ) Meersburg mit der Burg', city: 'Meersburg' },
  { sku: 'MEERSBURG-04', name: '(AQ) Meersburg Város Látkép 2', nameDE: null, city: 'Meersburg' },
  { sku: 'MEERSBURG-05', name: '(AQ) Meersburg Város Látkép 3', nameDE: null, city: 'Meersburg' },
  { sku: 'MEERSBURG-06', name: 'Meersburgi bambusztoll', nameDE: 'Bambus-Kugelschreiber', city: 'Meersburg' },
  { sku: 'MEERSBURG-07', name: 'Meersburgi Vár', nameDE: null, city: 'Meersburg' },
  { sku: 'MEERSBURG-08', name: 'Meersburg Skyline', nameDE: 'Meersburg Skyline', city: 'Meersburg' },
  // ── KIRCHEN ──
  { sku: 'KIRCHEN-02', name: 'Angyal gyermekkel', nameDE: 'Engel mit Kind', city: 'Kirchen' },
  // ── HEIDELBERG ──
  { sku: 'HEIDELBERG-01', name: '(GO) Heidelberg kis majommal', nameDE: '(GO) Heidelberg mit kleinem Affen', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-02', name: '(GO) Heidelbergi panoráma a kastéllyal (nagy)', nameDE: '(GO) Panorama von Heidelberg mit Schloss (groß)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-03', name: '(AQ) Heidelbergi híd', nameDE: '(AQ) Heidelberger Brücke', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-04', name: '(AQ) Heidelbergi hattyú', nameDE: '(AQ) Heidelberger Schwan', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-05', name: '(AQ) Heidelbergi város látkép (nagy)', nameDE: '(AQ) Heidelberger Stadtansicht (groß)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-06', name: '(AQ) Heidelbergi kapu', nameDE: '(AQ) Heidelberger Tor', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-07', name: '(AQ) Heidelbergi kastély', nameDE: '(AQ) Heidelberger Schloss', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-08', name: '(AQ) Heidelbergi szobor', nameDE: '(AQ) Heidelberger Skulptur', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-09', name: '(AQ) Heidelbergi nagybetűs', nameDE: '(AQ) Laserschnitt – Kühlschrankmagnet, bunt – Heidelberger Schloss', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-10', name: 'Lézervágott fa – Heidelbergi kapu', nameDE: 'Laserschnitt – Kühlschrankmagnet, natur – Heidelberger Tor', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-11', name: 'Lézervágott fa – Heidelbergi majom', nameDE: 'Laserschnitt – Kühlschrankmagnet, natur – Heidelberger Affe', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-12', name: 'Toll minta – Heidelbergi címer oroszlánnal', nameDE: 'Kugelschreiber Motiv – Heidelberger Wappen mit Löwe', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-13', name: 'Toll minta – Heidelberg felirat + kis majom', nameDE: 'Kugelschreiber Motiv – Heidelberg Aufschrift + kleiner Affe', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-14', name: '(BM) Egyrétegű hűtőmágnes bélyeg stílusban (Városlátkép)', nameDE: '(BM) Einlagiger Kühlschrankmagnet im Briefmarken-Look (Stadtansicht)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-15', name: '(BM) Kétrétegű hűtőmágnes bélyeg stílusban (Hajó a Neckar folyón)', nameDE: '(BM) Zweilagiger Kühlschrankmagnet im Briefmarken-Look (Schiff auf dem Neckar)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-16', name: '(BM) Kétrétegű hűtőmágnes bélyeg stílusban (Templom a híddal)', nameDE: '(BM) Zweilagiger Kühlschrankmagnet im Briefmarken-Look (Kirche mit Brücke)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-17', name: '(BM) Kétrétegű hűtőmágnes bélyeg stílusban (A városkapu távolabbról)', nameDE: '(BM) Zweilagiger Kühlschrankmagnet im Briefmarken-Look (Das Stadttor aus der Ferne)', city: 'Heidelberg' },
  { sku: 'HEIDELBERG-18', name: '(BM) Kétrétegű hűtőmágnes bélyeg stílusban (A városkapu közelebbről)', nameDE: '(BM) Zweilagiger Kühlschrankmagnet im Briefmarken-Look (Das Stadttor aus der Nähe)', city: 'Heidelberg' },
  // ── BAD URACH ──
  { sku: 'BAD-URACH-01', name: '(GO) Vízesés a kis híddal', nameDE: '(GO) Wasserfall mit der kleinen Brücke', city: 'Bad Urach' },
  { sku: 'BAD-URACH-02', name: '(AQ) Urach-i vízesés', nameDE: '(AQ) Uracher Wasserfall', city: 'Bad Urach' },
  { sku: 'BAD-URACH-03', name: '(AQ) Hohenurach-i várrom', nameDE: '(AQ) Hohenuracher Burgruine', city: 'Bad Urach' },
  { sku: 'BAD-URACH-04', name: '(AQ) Kastély rezidencia', nameDE: '(AQ) Residenzschloß', city: 'Bad Urach' },
  { sku: 'BAD-URACH-05', name: '(AQ) Városháza virágokkal', nameDE: '(AQ) Rathaus mit Blumen', city: 'Bad Urach' },
  { sku: 'BAD-URACH-06', name: '(AQ) Piactér napnyugtakor', nameDE: '(AQ) Marktplatz im Sonnenuntergang', city: 'Bad Urach' },
  { sku: 'BAD-URACH-07', name: 'Lézervágott hűtőmágnes (natúr): Bad Urach-i vízesés', nameDE: 'Laserschnitt – Kühlschrankmagnet (natur): Bad Uracher Wasserfall', city: 'Bad Urach' },
  { sku: 'BAD-URACH-08', name: 'Lézervágott hűtőmágnes (natúr): Kos táblával', nameDE: 'Laserschnitt – Kühlschrankmagnet (natur): Widder mit Schild', city: 'Bad Urach' },
  { sku: 'BAD-URACH-09', name: '(AQ) Lézervágott és UV-nyomott kulcstartó: Bad Urach-i vízesés', nameDE: 'Laserschnitt und UV-gedrückter Schlüsselanhänger: Bad Uracher Wasserfall', city: 'Bad Urach' },
  // ── OHRSTECKER ──
  { sku: 'OHRSTECKER-0701', name: 'Róka (vonalrajzos)', nameDE: 'Fuchs-01', city: 'Ohrstecker' },
  { sku: 'OHRSTECKER-0801', name: 'Ló (vonalrajzos)', nameDE: 'Pferd-01', city: 'Ohrstecker' },
  { sku: 'OHRSTECKER-0901', name: 'Bagoly (vonalrajzos)', nameDE: 'Eule-01', city: 'Ohrstecker' },
  { sku: 'OHRSTECKER-1001', name: 'Űrhajós (teli)', nameDE: 'Astronaut-01', city: 'Ohrstecker' },
  { sku: 'OHRSTECKER-1002', name: 'Űrhajós (üres)', nameDE: 'Astronaut-02', city: 'Ohrstecker' },
]

export async function GET() {
  const results: { sku: string; status: string }[] = []

  for (const p of PRODUCTS) {
    try {
      const existing = await prisma.product.findUnique({ where: { sku: p.sku } })
      if (existing) {
        await prisma.product.update({
          where: { sku: p.sku },
          data: { name: p.name, nameDE: p.nameDE ?? undefined, city: p.city },
        })
        results.push({ sku: p.sku, status: 'frissítve' })
      } else {
        await prisma.product.create({
          data: {
            sku: p.sku,
            name: p.name,
            nameDE: p.nameDE ?? undefined,
            city: p.city,
            stock: 0,
            minStock: 0,
            salesPrice: 0,
            costPrice: 0,
          },
        })
        results.push({ sku: p.sku, status: 'létrehozva' })
      }
    } catch (e) {
      results.push({ sku: p.sku, status: `hiba: ${e}` })
    }
  }

  const created = results.filter(r => r.status === 'létrehozva').length
  const updated = results.filter(r => r.status === 'frissítve').length
  const errors = results.filter(r => r.status.startsWith('hiba')).length

  return NextResponse.json({ ok: true, created, updated, errors, details: results })
}
