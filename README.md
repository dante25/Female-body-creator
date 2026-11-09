# Female Body Creator

Android aplikacija: realistični bazni 3D model ženskog tijela + slajderi za anatomiju,
character sheet (sprijeda / profil / otpozadi) i export.

## Mogućnosti
- **Bazni model**: MakeHuman base mesh (CC0), mlada odrasla žena, ~13.5k verteksa.
- **37 slajdera** (−100 … +100) u grupama: Tijelo, Glava i vrat, Trup, Grudi, Ruke, Noge.
  Slajderi su pravi morph targeti (MakeHuman, CC0) – povećavaju/smanjuju dijelove anatomije.
  Dupli dodir na naziv slajdera vraća ga na 0.
- **3D** prikaz (rotacija/zum prstima, pogledi, boja kože) i **List** (character sheet sa vodilicama u 8 jedinica).
- **Likovi**: spremanje pod imenom, učitavanje, brisanje + gotovi predlošci.
- **Export**: character sheet PNG (2400 px), trenutni prikaz PNG, 3D model OBJ (cm), postavke JSON; uvoz JSON-a.
  Na telefonu: PNG → `Slike/BodyCreator`, OBJ/JSON → `Download/BodyCreator`.
- Radi offline.

## APK
Svaki push pokreće workflow **Build APK** → `BodyCreator.apk` na stranici **Releases**.

## Struktura
- `web/` – aplikacija (three.js); `web/model/body.bin|json` – bazni mesh + morph targeti.
- `tools/build_model.py` – generiše `web/model/*` iz MakeHuman podataka (uputstvo u fajlu).
- `app/` – Android omotač (WebView), `web/` se pakuje u assets.

Licenca 3D podataka: MakeHuman assets, CC0 1.0.
