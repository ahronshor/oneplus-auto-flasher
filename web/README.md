# OnePlus Web Flasher (Hebrew UX)

ממשק ווב ללקוחות קצה לצורך זיהוי מכשיר OnePlus והנחיה ברורה לפני צריבה.

## מה נתמך
- חיבור USB דרך Chrome/Edge (WebUSB).
- זיהוי מצב חיבור ADB/Fastboot.
- קריאת דגם וגרסה ב-ADB.
- הנחיה אוטומטית אם אפשר לצרוב או שצריך עדכון גרסה לפני צריבה.
- בחירת תיקיית הורדות, איתור ZIP עדכון מתאים, ו-`ADB push` ל-`/sdcard/`.
- צריבת `init_boot` במצב Fastboot.
- רישום מקומי מתמשך לפי סריאלי (`localStorage`) ותצוגת התקדמות שלב-אחר-שלב.
- צ'קליסט הכנה אינטראקטיבי (פתיחת מצב מפתחים/ADB) עם שמירה מקומית בדפדפן.
- תצוגת Wizard: המשתמש רואה רק את הפעולות הרלוונטיות לשלב הנוכחי.
- אחרי לחיצה על הורדת ZIP: סריקה אוטומטית בתיקיית ההורדות עד שמתגלה קובץ מתאים.
- זיהוי מכשיר לא נתמך לפי רשימת הדגמים הנתמכים והצגת הודעה ברורה למשתמש.
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
- הקובץ `manifest.json` מגדיר אילו גרסאות נתמכות ואיזה קובץ `init_boot` מתאים לכל דגם.
- הקובץ `device_map.txt` משמש למיפוי product codename -> model.

## הערה חשובה
אם ה-Bootloader נעול, חייבים לפתוח אותו לפני צריבה, וזה מוחק את נתוני המכשיר.

## הרשאות לתיקיית הורדות
הדפדפן לא יכול לגשת אוטומטית ל-`Downloads`. המשתמש חייב לבחור תיקייה ידנית דרך הכפתור
`בחר תיקיית הורדות` ולאשר הרשאת קריאה.

## זרימת עבודה מומלצת למשתמש קצה
1. חיבור ב-ADB לזיהוי דגם וגרסה.
2. אם נדרש עדכון: הורדה + `ADB push` + התקנה במכשיר (Local install).
3. לחיצה באתר על `סיימתי להתקין עדכון במכשיר`.
4. מעבר ל-Fastboot, פתיחת Bootloader ואישור במכשיר עם `Volume Plus`.
5. מיד אחרי האישור: לחיצה ארוכה על `Power + Volume Minus` לחזרה ל-Fastboot.
6. צריבת `init_boot` והפעלה מחדש.

## אם WebADB עובד אבל כאן לא
1. לוודא שהאתר רץ ב-`http://localhost` או `https://` (לא בכתובת `http://192.168...`).
2. לסגור לשוניות אחרות של WebADB שעשויות להחזיק את ממשק ה-USB.
3. לנתק ולחבר מחדש את הכבל ואז ללחוץ שוב על `חיבור ADB`.
4. ב-Windows: לוודא שהדרייבר של המכשיר אכן נטען במצב הנכון (ADB/Fastboot).
5. לבדוק את `לוג תהליך` בתחתית המסך - שם מופיעה סיבת הכשל המדויקת.
