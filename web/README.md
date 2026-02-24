# Android Web Flasher (Hebrew UX)

ממשק ווב ללקוחות קצה לצורך זיהוי מכשירי OnePlus/Xiaomi/Pixel והנחיה ברורה לפני צריבה.

## מה נתמך
- חיבור USB דרך Chrome/Edge (WebUSB).
- זיהוי מצב חיבור ADB/Fastboot.
- קריאת דגם וגרסה ב-ADB.
- הנחיה אוטומטית אם אפשר לצרוב או שצריך עדכון גרסה לפני צריבה.
- עדכון ידני מודרך: קישור הורדה לגרסה נדרשת + דף הוראות `Local install`.
- בדיקת גרסה מחדש ב-ADB אחרי העדכון הידני כדי לוודא התאמה לפני צריבה.
- צריבת `init_boot` במצב Fastboot.
- רישום מקומי מתמשך לפי סריאלי (`localStorage`) ותצוגת התקדמות שלב-אחר-שלב.
- צ'קליסט הכנה אינטראקטיבי (פתיחת מצב מפתחים/ADB) עם שמירה מקומית בדפדפן.
- תצוגת Wizard: המשתמש רואה רק את הפעולות הרלוונטיות לשלב הנוכחי.
- זיהוי מכשיר לא נתמך לפי רשימת הדגמים הנתמכים והצגת הודעה ברורה למשתמש.
- במכשירי Xiaomi/Pixel: אם הגרסה לא תואמת בדיוק, נעצרים ומפנים לקבוצת הצריבות (ללא מסלול עדכון ביניים).
- במכשירי OnePlus: אם הגרסה ישנה מהנתמך, אפשר לבצע עדכון ביניים ידני; אם הגרסה חדשה יותר, נעצרים ופונים לקבוצה.
- כפתור `המשך אוטומטי` שמנסה להריץ את הפעולה הבאה (ADB/Fastboot/Unlock/Flash) בלחיצה אחת.
- בשלב הצריבה: ברירת המחדל היא צריבה אוטומטית מקבצי `images` של האתר (ללא בחירת קובץ ידנית).

## דרישות
1. דפדפן Chrome / Edge עדכני.
2. הרצה תחת `https://` או `http://localhost`.
3. דרייברים תקינים (במיוחד ב-Windows).
4. במכשיר: הפעלת USB Debugging ו-OEM Unlocking.

## הכנת המכשיר (לפני חיבור ADB)
1. בטלפון: `Settings -> About phone -> Software information`.
2. לחיצה 7 פעמים על `Build number` עד הפעלת מצב מפתחים.
3. מעבר ל-`Developer options` (לפעמים תחת `System` או `Additional settings`).
4. להפעיל `USB Debugging` וגם `OEM Unlocking`.
5. לחבר USB, להשאיר מסך פתוח, ולאשר `Allow USB debugging` (רצוי עם `Always allow`).

## הפעלה מקומית
אפשר להגיש את הקבצים עם שרת סטטי פשוט מהשורש:

```bash
cd /Users/mosheshor/apps/oneplus_flasher_git\ copy
python3 -m http.server 8080
```

ואז לפתוח בדפדפן:

```text
http://localhost:8080/web/
```

## פריסה ל-GitHub Pages
הפרויקט כולל workflow מוכן:

`/Users/mosheshor/apps/oneplus_flasher_git copy/.github/workflows/pages.yml`

מה צריך לעשות:
1. לבצע `commit` + `push` ל-`main` (או `master`).
2. ב-GitHub: `Settings -> Pages -> Source = GitHub Actions`.
3. להמתין לסיום ה-workflow `Deploy Web Flasher to GitHub Pages`.

## התאמת נתוני גרסאות/קבצים
- במצב רגיל, ההחלטה נעשית דרך API:
`GET https://admin-prod.koshersvr.com/api/rom_boot_link?company=<op|xi|pi>&model=<MODEL>&version=<VERSION>`
- רשימת הדגמים/גרסאות הנתמכים מנוהלת בצד השרת (Odoo + S3), לא בקבצי האתר.
- אין fallback מקומי לצריבה: אם ה-API לא מחזיר החלטה תקינה, הכלי עוצר כדי למנוע צריבה שגויה.
- הקובץ `device_map.txt` משמש למיפוי product codename -> model.
- דף ההוראות לעדכון ידני נמצא ב-`update-guide.html`.
- קישור לקבוצת וואטסאפ (לגרסאות חדשות מדי) מוגדר בקבוע `SUPPORT_WHATSAPP_URL` בקובץ `app.js`.

### מיפוי תגובות API לכלי
- `status=200` עם `link`: גרסה נתמכת בדיוק -> צריבה אוטומטית זמינה.
- `status=202` עם `type=full_flash`: (OnePlus) נדרש עדכון ביניים ידני לפני צריבה.
- `status=202` עם `type=need_build`: לא נתמך כרגע -> עצירה והפניה לקבוצת הצריבות.
- `status=404`: דגם/ROM לא נמצאו -> עצירה והודעת שגיאה.
- מיפוי `company` נעשה לפי `brand` שנקרא מהמכשיר ב-ADB: `oneplus/oppo/oplus -> op`, `xiaomi/redmi/poco -> xi`, `google -> pi`.

## הערה חשובה
אם ה-Bootloader נעול, חייבים לפתוח אותו לפני צריבה, וזה מוחק את נתוני המכשיר.

## זרימת עבודה מומלצת למשתמש קצה
1. חיבור ב-ADB לזיהוי דגם וגרסה.
2. OnePlus בלבד: אם נדרש עדכון ביניים, הורדת ZIP, התקנה ידנית דרך `Local install`, ואז `בדוק שוב גרסה ב-ADB`.
3. Xiaomi/Pixel: בכל אי-התאמה בגרסה עוצרים ופונים לקבוצת הצריבות (ללא downgrade/upgrade דרך הכלי).
4. מעבר ל-Fastboot, פתיחת Bootloader ואישור במכשיר עם `Volume Plus`.
5. מיד אחרי האישור: לחיצה ארוכה על `Power + Volume Minus` לחזרה ל-Fastboot.
6. צריבת `init_boot` והפעלה מחדש.

## אם WebADB עובד אבל כאן לא
1. לוודא שהאתר רץ ב-`http://localhost` או `https://` (לא בכתובת `http://192.168...`).
2. לסגור לשוניות אחרות של WebADB שעשויות להחזיק את ממשק ה-USB.
3. לנתק ולחבר מחדש את הכבל ואז ללחוץ שוב על `חיבור ADB`.
4. ב-Windows: לוודא שהדרייבר של המכשיר אכן נטען במצב הנכון (ADB/Fastboot).
5. לבדוק את `לוג תהליך` בתחתית המסך - שם מופיעה סיבת הכשל המדויקת.
