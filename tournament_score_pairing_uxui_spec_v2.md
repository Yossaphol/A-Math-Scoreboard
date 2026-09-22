# Tournament Score & Pairing System --- UX/UI Design Specification

สร้างเว็บสำหรับจัดการแข่งขัน จับคู่ผู้เล่น เก็บคะแนน และแสดงผลการแข่งขัน โดยเน้นที่ UX/UI
Prototype ของระบบทั้งฝั่งหน้าบ้าน (Public/User) และหลังบ้าน (Admin)

ระบบแบ่งออกเป็น 2 ส่วนหลัก คือ Public/User และ Admin โดย User
สามารถเข้าดูข้อมูลการแข่งขันได้โดยไม่จำเป็นต้อง Login ส่วน Admin ต้อง Authentication
ก่อนจึงจะสามารถเข้าหน้า `/admin` ได้

------------------------------------------------------------------------

## 1. โครงสร้างผู้เล่น ระบบ User และ Role

ระบบต้องมี Player ID อยู่ 2 ระดับ คือ **Global Player ID ของผู้เล่นในระบบ** และ
**Tournament Player ID ของผู้เล่นภายในแต่ละ Tournament**

ระบบหลังบ้านมี 2 Role หลัก คือ **Admin** และ **Staff**

### Admin

Admin เป็นผู้ดูแลระบบระดับ Global สามารถ:

-   เห็นและจัดการ Tournament ทั้งหมดในระบบ
-   สร้าง Tournament
-   จัดการ Global Player ทั้งหมด
-   เพิ่ม / จัดการ Staff และกำหนด Staff ให้กับ Tournament
-   จัดการ Admin ตามระบบ Admin Management
-   จัดการข้อมูลและ Setting ของ Tournament ทุก Tournament
-   เข้าใช้งานทุก Function ของ Tournament ได้

### Staff

Staff เป็นผู้ดูแลเฉพาะ Tournament ที่ Admin มอบหมายให้

Staff สามารถ:

-   เห็นเฉพาะ Tournament ที่ตนเองถูกเพิ่มเป็น Staff
-   เข้า Tournament ที่ได้รับมอบหมาย
-   จัดการ Players ภายใน Tournament นั้น
-   Generate / Preview / Edit / Confirm Pairing
-   จัดการ Rounds
-   จัดการ Scoreboard และแก้ไขผลการแข่งขัน
-   จัดการ Tables / QR
-   จัดการ Tournament Settings ของ Tournament ที่ตนเองรับผิดชอบ
-   ใช้ Function ภายใน Tournament ได้เช่นเดียวกับ Admin

Staff **ไม่สามารถ**:

-   ดู Global Player ทั้งหมดในระบบ
-   ดู Tournament อื่นที่ตนเองไม่ได้รับมอบหมาย
-   สร้าง Tournament ใหม่
-   เพิ่ม / ลบ / แก้ไข Admin
-   จัดการ Staff หรือสิทธิ์ของ Staff ในระดับ Global เว้นแต่ระบบจะกำหนดให้ Admin
    เป็นผู้ทำ
-   เข้าถึงข้อมูล Global ที่อยู่นอกขอบเขตของ Tournament ที่ได้รับมอบหมาย

หลักการสำคัญคือ **Staff มีสิทธิ์ระดับ Tournament Admin แต่ไม่มีสิทธิ์ระดับ Global
Admin**

สิทธิ์ควรถูกตรวจสอบทั้งใน Frontend และ Backend โดย Backend ต้องเป็นผู้บังคับใช้สิทธิ์จริง
ไม่ควรพึ่งเพียงการซ่อนเมนูใน UI

Global Player ID เป็น ID ประจำตัวของผู้เล่นใน Database และจะเป็น ID
เดิมตลอดการใช้งาน เช่น ผู้เล่นคนหนึ่งมี Player ID = 15 เมื่อเข้าร่วม Tournament
หลายรายการก็ยังคงเป็น Player ID = 15

ส่วน Tournament Player ID เป็น ID ที่ใช้ระบุผู้เล่นภายใน Tournament นั้น ๆ โดยแต่ละ
Tournament จะเริ่มนับใหม่จาก `1` ไปเรื่อย ๆ เช่น Tournament A มีผู้เล่น 24 คน จะมี
Tournament Player ID ตั้งแต่ 1--24 และเมื่อสร้าง Tournament B ใหม่ก็จะเริ่มจาก 1
อีกครั้ง

ดังนั้นผู้เล่นหนึ่งคนสามารถเข้าร่วมหลาย Tournament ได้
โดยประวัติการแข่งขันทั้งหมดจะเชื่อมกลับมายัง Global Player คนเดียวกัน

การเพิ่มผู้เล่นเข้า Tournament **ไม่ใช้ระบบสมัคร Tournament จากฝั่ง User แล้ว** แต่ให้
Admin เป็นผู้จัดการผู้เล่นทั้งหมด โดย Admin สามารถ Import รายชื่อผู้เล่นเข้ามา เช่น CSV,
เพิ่มผู้เล่นใหม่เอง หรือค้นหา Player ที่มีอยู่ในระบบแล้วนำเข้ามาใน Tournament ได้

เมื่อ Import หรือเพิ่มผู้เล่นเข้า Tournament ระบบจะสร้าง Tournament Player ID
ให้เรียงจาก `1` ตามลำดับ

------------------------------------------------------------------------

## 2. Public / User Website

ฝั่ง User เป็นหน้า Public ที่สามารถเปิดดูข้อมูล Tournament ได้ทันทีโดยไม่ต้อง Login
ผู้ใช้สามารถเข้ามาดูว่าในระบบมี Tournament ใดกำลังเปิดอยู่
และสามารถกดเข้าไปดูรายละเอียดของ Tournament ได้

หน้าแรกสามารถแสดงรายการ Tournament เช่น Tournament ที่กำลังแข่งขัน, Tournament
ที่กำลังเปิดดูผลการแข่งขัน และ Tournament ที่จบไปแล้ว พร้อม Search สำหรับค้นหา
Tournament

เมื่อเข้า Tournament สามารถดูข้อมูลหลัก ๆ ได้แก่ การจับคู่ของรอบปัจจุบัน, Scoreboard,
ผลการแข่งขันของแต่ละรอบ และประวัติการแข่งขันย้อนหลัง โดยไม่ต้อง Authentication

ในหน้า Current Pairing ต้องมี Search Bar สำหรับค้นหาผู้เล่นด้วยชื่อ, Nickname,
Global Player ID หรือ Tournament Player ID
เพื่อให้สามารถค้นหาได้ว่าผู้เล่นคนนั้นกำลังแข่งกับใครและอยู่โต๊ะไหน

User สามารถเลือก Round ย้อนหลังเพื่อดูผลการแข่งขันของเกมก่อนหน้าได้ โดยสามารถเลือกดู
Round ไหนก็ได้ ไม่จำกัดเฉพาะ Round ปัจจุบัน

------------------------------------------------------------------------

## 3. Public Tournament Scoreboard และผลการแข่งขันของผู้เล่น

ในหน้า Tournament จะมี Scoreboard ที่แสดงผลรวมของผู้เล่นทั้งหมด เช่น ชื่อ,
คะแนนสะสม, จำนวนชนะ, เสมอ, แพ้ และผลต่างสะสม

นอกจาก Scoreboard รวมของ Tournament แล้ว ฝั่ง User
ต้องมีตารางผลการแข่งขันของผู้เล่นแต่ละเกมด้วย โดยแสดงว่าในแต่ละ Round ผู้เล่นได้ W/T/L
เท่าไหร่ คะแนนสะสมหลังจบรอบนั้นเท่าไหร่ คะแนนที่ผู้เล่นทำได้ คะแนนของคู่แข่ง
ผลต่างของเกมนั้น ผลต่างสะสม และชื่อคู่แข่ง

User สามารถเลือก Round เพื่อดูผลการแข่งขันของแต่ละเกมย้อนหลังได้ และสามารถ Search
ชื่อหรือ ID ผู้เล่นเพื่อดูข้อมูลของผู้เล่นที่ต้องการ

------------------------------------------------------------------------

## 4. User Account และ Google Login

การ Login ไม่ใช่สิ่งที่จำเป็นสำหรับการดู Tournament เพราะ User สามารถเปิดเว็บเพื่อดู
Scoreboard, Pairing และผลการแข่งขันได้ทันทีโดยไม่ต้อง Login

อย่างไรก็ตาม ให้มีปุ่ม `User` หรือ Profile บนหน้าเว็บ ซึ่งผู้ใช้สามารถเลือก Login ด้วย
Google ได้หากต้องการใช้ Feature ที่เกี่ยวข้องกับบัญชีของตัวเอง

Google Login มีไว้สำหรับผูก Google Account เข้ากับ **Global Player ID** ไม่ใช่
Tournament Player ID

เมื่อ User Login แล้วแต่ยังไม่ได้ผูก Player Account ระบบสามารถให้ User ส่งคำขอผูก
Player ID ของตัวเอง แต่ไม่ควรให้ User สามารถผูกบัญชีเข้ากับ Player ID ได้ทันที
เพราะอาจนำไปผูกกับบัญชีของผู้อื่นได้

ให้ระบบสร้าง Link Request ส่งให้ Admin ตรวจสอบก่อน เมื่อ Admin Approve แล้ว
Google Account จึงจะถูกผูกกับ Global Player ID นั้น

หลังจากผูกบัญชีแล้ว User สามารถใช้ Account เพื่อดู Profile, Tournament History
และ Match History ของตัวเองได้ โดย Feature เหล่านี้เป็น Feature เสริม
และไม่ได้บังคับให้ User ต้อง Login เพื่อดู Tournament

------------------------------------------------------------------------

## 5. Authentication, Admin Management และ Staff Management

ทุกหน้าที่อยู่ภายใต้ `/admin` ต้องมี Authentication ก่อนเข้าถึง เช่น `/admin`,
`/admin/tournaments`, `/admin/players`, `/admin/pairing` และ
`/admin/scoreboard`

หลัง Login ระบบต้องตรวจสอบ Role และ Scope ก่อนอนุญาตให้เข้าถึงข้อมูล

หากยังไม่ได้ Authentication แล้วพยายามเปิด `/admin` ให้เข้าสู่หน้า Login ก่อน
และไม่สามารถเข้าถึงข้อมูลหรือหน้า Admin ใด ๆ ได้

ระบบจะมี Admin หลักอยู่หนึ่งคน ซึ่งสามารถเพิ่ม Admin คนอื่นได้โดยกรอก Gmail ของ Admin
คนใหม่ จากนั้น Gmail ดังกล่าวสามารถใช้ Google Authentication เพื่อเข้าสู่ `/admin`
ได้

**เฉพาะ Admin เท่านั้น** ที่สามารถ:

-   เพิ่ม / จัดการ Admin
-   ดู Global Players ทั้งหมด
-   สร้าง Tournament
-   เพิ่ม / ถอน Staff จาก Tournament
-   จัดการสิทธิ์ของ Staff

Staff ไม่สามารถเข้าถึง Admin Management และไม่สามารถสร้าง Tournament

ในฝั่ง Admin ยังมีหน้า Account Link Requests สำหรับตรวจสอบคำขอจาก User
ที่ต้องการเชื่อม Google Account กับ Global Player ID

## 6. Role, Staff Assignment และ Permission Scope

การกำหนด Staff ต้องทำโดย Admin เท่านั้น

Flow การเพิ่ม Staff:

``` text
Admin
  ↓
เลือก User
  ↓
เลือก Tournament
  ↓
Add as Staff
  ↓
User ได้สิทธิ์ Staff สำหรับ Tournament นั้น
```

Staff Assignment ต้องผูกอย่างน้อยกับ:

-   User / Account
-   Tournament
-   Role = Staff
-   Status เช่น Active / Revoked

ตัวอย่าง:

``` text
User A
 ├── Tournament 1 → Staff
 ├── Tournament 2 → Staff
 └── Tournament 3 → ไม่มีสิทธิ์
```

เมื่อ Staff Login เข้ามา ระบบควรแสดงเฉพาะ Tournament ที่ Staff มีสิทธิ์เท่านั้น

``` text
Staff Dashboard

My Tournaments
├── Tournament A
└── Tournament C
```

เมื่อเข้า Tournament ที่ได้รับมอบหมาย Staff สามารถเห็นเมนู:

``` text
Tournament Overview
Players
Pairing
Scoreboard
Rounds
Tables / QR
Settings
```

โดย Function ภายใน Tournament ใช้ชุดเดียวกับ Admin เพื่อไม่ให้เกิดความแตกต่างของ
Logic ระหว่างผู้ดูแล Tournament

อย่างไรก็ตาม การเรียก API ทุกตัวต้องตรวจสอบ Scope เช่น:

``` text
Admin:
  GET /api/tournaments/*              → allowed

Staff:
  GET /api/tournaments/A              → allowed if assigned
  GET /api/tournaments/B              → forbidden if not assigned
  GET /api/players                    → forbidden
  POST /api/tournaments               → forbidden
  POST /api/admins                    → forbidden
```

Admin Management และ Staff Assignment เป็น Global Management
จึงอยู่ในขอบเขตของ Admin เท่านั้น

------------------------------------------------------------------------

## 6. Admin --- Global Player Management

ฝั่ง Admin ต้องมีหน้าสำหรับดูและจัดการผู้เล่นทั้งหมดในระบบ
โดยสามารถออกแบบเป็นตารางจัดการ User เช่น มี Player ID, Name, Profile/Account
Status และปุ่ม Detail

เมื่อกด Detail สามารถดูข้อมูลผู้เล่น เช่น ชื่อ, Nickname, Global Player ID, Google
Account ที่ผูกไว้ และประวัติการเข้าร่วม Tournament

ใน Player Detail สามารถแก้ไขข้อมูลผู้เล่น ดูประวัติการแข่งขัน และจัดการ Account Link
ได้

------------------------------------------------------------------------

## 7. Tournament Management และการสร้าง Tournament

Admin สามารถสร้าง Tournament ใหม่จากหน้า Create Tournament โดยมีข้อมูลพื้นฐาน
เช่น ชื่อ Tournament

ในการสร้าง Tournament ให้มี Setting สำหรับจำนวนผู้เล่นและจำนวนเกม โดย **แยก
Toggle ออกจากกัน** ไม่รวมเป็น Setting เดียวกัน

Toggle สำหรับกำหนดจำนวนผู้เล่น:

``` text
Set Player Limit
[ ON ]

Maximum Players
[ 24 ]
```

Toggle สำหรับกำหนดจำนวนเกม:

``` text
Set Number of Games
[ ON ]

Number of Games
[ 6 ]
```

ทั้งสอง Setting สามารถเปิด/ปิดแยกกันได้ และ Default
คือเปิดการกำหนดจำนวนผู้เล่นและจำนวนเกม

นอกจากนี้ให้เลือก Tournament Mode ได้ 2 แบบ คือ **Competition** และ
**Practice**

Competition คือการแข่งขันปกติที่ใช้ระบบ Pairing และ Score ตามกติกาที่กำหนด

Practice คือโหมดฝึกซ้อมสำหรับเก็บประวัติและคะแนนการซ้อม
โดยไม่บังคับว่าผู้เล่นทุกคนต้องแข่งครบทุกเกมหรือแข่งพร้อมกัน
ผู้เล่นแต่ละคนสามารถมีจำนวนเกมไม่เท่ากันได้
และระบบยังคงเก็บผลการแข่งขันที่เกิดขึ้นจริงไว้เพื่อดูย้อนหลัง

------------------------------------------------------------------------

## 8. Tournament Scoring Settings

**Maximum Score เป็น Setting ระดับ Game/Match ไม่ใช่ Setting ระดับ
Tournament**

Tournament เดียวกันสามารถมี Game ที่ใช้ Maximum Score แตกต่างกันได้ เช่น:

``` text
Tournament A

Round 1 / Game 1 → Maximum Score = 350
Round 2 / Game 2 → Maximum Score = 250
Round 3 / Game 3 → Maximum Score = OFF
```

ดังนั้นห้ามออกแบบ Database หรือ UI ให้ Tournament มีค่า Maximum Score เพียงค่าเดียว
แล้วบังคับใช้กับทุกเกม

ในแต่ละ Game ให้มี:

``` text
Maximum Score
[ ON / OFF ]

ถ้า ON:
Maximum Score
[ 350 ]
```

ตัวอย่างค่าที่ระบบรองรับอาจเป็น:

``` text
250
350
Custom value
```

หาก Maximum Score ถูกเปิดใช้งาน คะแนนของผู้เล่นที่เกินค่าที่กำหนดต้องถูก Cap
ก่อนนำไปใช้คำนวณ Game Difference ตาม Logic ของระบบ

ตัวอย่าง:

``` text
Maximum Score = 350

Player A = 380
Player B = 320

คะแนนที่ใช้คำนวณ Difference:
Player A = 350
Player B = 320

Diff = +30
```

ถ้า Maximum Score = OFF ให้ใช้คะแนนจริงของ Game โดยไม่ Cap

**สำคัญ:** W/T/L และระบบคะแนน Tournament ยังคงใช้:

``` text
W = 2
T = 1
L = 0
```

ดังนั้น Maximum Score มีผลกับ **คะแนนของ Game และ Game Difference**
ไม่ได้เปลี่ยนค่า W/T/L

การสร้าง Tournament สามารถกำหนดค่า Default สำหรับ Game ใหม่ได้ เช่น `350` แต่ค่า
Default นี้เป็นเพียงค่าเริ่มต้นของแต่ละ Game และสามารถแก้เป็น `250` หรือปิด Maximum
Score สำหรับ Game นั้นได้

## 9. Pairing และการจัดการแข่งขัน

หลังจากสร้าง Tournament แล้ว Admin หรือ Staff ของ Tournament
นั้นสามารถเข้าสู่หน้าการจับคู่ ของแต่ละ Round และเลือกวิธี Pairing ได้
โดยระบบต้องรองรับ:

-   Random
-   Swiss
-   King of the Hill
-   Round Robin

**ห้ามเปลี่ยน Core Logic ของ Pairing เพียงเพื่อให้ UI ใช้งานง่ายขึ้น** UI
เป็นเพียงการแสดงผลและการควบคุม Input ของ Logic

### 9.1 Random

Random คือการสุ่มลำดับผู้เล่นที่ยัง Active แล้วจับคู่ตามลำดับ

ตัวอย่าง:

``` text
ผู้เล่น:
1, 2, 3, 4, 5, 6

หลัง Random:
4, 1, 6, 2, 5, 3

Pairing:
4 vs 1
6 vs 2
5 vs 3
```

ผู้เล่นที่ Withdrawn จะไม่ถูกนำเข้ากระบวนการ Pairing

### 9.2 King of the Hill

King of the Hill จับคู่ตามลำดับที่ระบบกำหนด เช่น:

``` text
1 vs 2
3 vs 4
5 vs 6
7 vs 8
```

เมื่อมีการจัดลำดับผู้เล่นก่อน Pairing ระบบต้องใช้ลำดับนั้นในการจับคู่ และต้องไม่สลับ Logic
เป็นระบบ Swiss โดยอัตโนมัติ

### 9.3 Swiss

Swiss ใช้ผลการแข่งขันของผู้เล่นเป็นข้อมูลสำคัญในการจัดกลุ่มและเลือกคู่

หลักการที่ต้องคงไว้:

1.  จัดผู้เล่นตามผลการแข่งขันปัจจุบัน
2.  แบ่งผู้เล่นที่มีผลการแข่งขันใกล้เคียงกันให้อยู่กลุ่มเดียวกัน
3.  พยายามจับคู่ผู้เล่นที่มีผลการแข่งขันใกล้เคียงกัน
4.  ตรวจสอบประวัติการพบกัน เพื่อหลีกเลี่ยงการเจอคู่เดิมเมื่อยังมีคู่ที่เป็นไปได้
5.  หากไม่สามารถหลีกเลี่ยง Rematch ได้ ให้เลือกคู่ตามลำดับการแก้ Conflict ของระบบ
6.  ผู้เล่นที่ Withdrawn จะไม่ถูกนำไป Pairing
7.  จำนวนผู้เล่นคี่ต้องรองรับ Bye ตาม Logic ของระบบ

ตัวอย่าง W/T/L ที่ใช้เป็นข้อมูลของผู้เล่น:

``` text
Player A → W W T = 5 points
Player B → W T L = 3 points
Player C → W W L = 4 points
Player D → T T W = 4 points
```

ค่า W/T/L ต้องคิดจาก:

``` text
W = 2
T = 1
L = 0
```

และ **ผลต่างสะสม** ต้องถูกแสดงเป็นข้อมูลประกอบในการพิจารณา Pairing เมื่อ Logic
ของระบบกำหนดให้ใช้เป็นตัวช่วยเรียงลำดับหรือแก้กรณีคะแนนเท่ากัน

### 9.4 Round Robin

Round Robin คือการจัดให้ผู้เล่นพบกันโดยไม่ซ้ำคู่จนกว่าทุกคู่ที่เป็นไปได้จะพบกันครบ

ทุกครั้งก่อน Confirm Pairing ระบบต้องตรวจสอบ Match History
ว่าคู่นั้นเคยพบกันแล้วหรือไม่

ตัวอย่าง:

``` text
Round 1:
A vs B
C vs D

Round 2:
A vs C
B vs D

Round 3:
A vs D
B vs C
```

ถ้ามีผู้เล่นจำนวนคี่ ระบบต้องจัด Bye ตาม Logic ที่กำหนดไว้

### 9.5 Pairing ต้องใช้ข้อมูลสถานะปัจจุบัน

ก่อน Generate Pairing ระบบต้องคำนวณข้อมูลล่าสุดของผู้เล่น เช่น:

``` text
Tournament Player ID
Name
W
T
L
Score
Cumulative Diff
Previous Opponents
First Count
Second Count
Status
```

ข้อมูลเหล่านี้ต้องมาจากผลการแข่งขันที่ Confirmed แล้ว

ผลการแข่งขันที่ยัง Conflict หรือยังไม่ Confirm
ไม่ควรถูกนำไปคำนวณเป็นผลการแข่งขันที่เสร็จสมบูรณ์

## 10. Pairing Preview, Max Diff Cap และการแก้ Pairing

เมื่อ Admin หรือ Staff เลือกวิธี Pairing และ Generate การจับคู่ของ Round นั้นแล้ว
ระบบต้องแสดง **Pairing Preview** ก่อนยืนยัน

ใน Preview ต้องแสดงข้อมูลที่ช่วยให้ผู้ดูแลตรวจสอบ Pairing ได้ทันที เช่น:

``` text
Table 1
#15 Somchai
W  4   T 1   L 1   Diff +120
        vs
#27 Anan
W  3   T 2   L 1   Diff +80

Table 2
#08 A
W  2   T 0   L 2   Diff -20
        vs
#19 B
W  2   T 1   L 1   Diff +40
```

**WTL และผลต่างสะสมต้องเป็นข้อมูลขนาดเล็กใต้ ID หรือชื่อ**
เพื่อให้ผู้ดูแลสามารถดูข้อมูลประกอบการ Pairing ได้ง่าย โดยไม่ทำให้ชื่อผู้เล่น
หรือข้อมูลหลักของ Pairing ดูรก

แนะนำการแสดงผล:

``` text
[15] Somchai
     W 4 · T 1 · L 1 · Diff +120

             VS

[27] Anan
     W 3 · T 2 · L 1 · Diff +80
```

ข้อมูล W/T/L และ Cumulative Diff ใน Preview เป็นข้อมูลประกอบการตรวจสอบ
ไม่ใช่การแก้ผลการแข่งขัน

### Drag & Drop

Admin หรือ Staff สามารถลากผู้เล่นเพื่อ:

-   เปลี่ยนคู่
-   สลับผู้เล่น
-   สลับโต๊ะ

ก่อนกดยืนยัน Pairing

การ Drag & Drop เป็นการแก้ผล Pairing ที่ระบบ Generate แล้วเท่านั้น ไม่ได้เปลี่ยน
Core Logic ของ Pairing Algorithm

### Max Diff Cap

Max Diff Cap อยู่ในขั้นตอน Pairing และสามารถกำหนดแตกต่างกันในแต่ละ Round/Game
ได้

ตัวอย่าง:

``` text
Round 1 / Game 1 → Max Diff Cap = 100
Round 2 / Game 2 → Max Diff Cap = 200
Round 3 / Game 3 → Max Diff Cap = OFF
```

Max Diff Cap จึงไม่ควรถูกเก็บเป็น Setting เดียวของ Tournament

## 11. First / Second และระบบจัดลำดับผู้เริ่มก่อน/หลัง

ระบบ First / Second เป็น Feature ที่สามารถเปิดหรือปิดได้ **ตั้งแต่ตอนสร้าง
Tournament**

ใน Create Tournament ให้มี Toggle:

``` text
Use First / Second Order System
[ ON ]
```

ถ้า OFF:

-   ไม่ต้องคำนวณ First / Second
-   ไม่ต้องสะสม First / Second
-   Pairing ไม่ต้องพิจารณาลำดับการเริ่มก่อน/หลัง
-   ฝั่ง User ไม่ต้องแสดงข้อมูล First / Second

ถ้า ON:

-   ระบบต้องเก็บ First / Second ของทุก Game
-   ใช้ข้อมูลสะสมในการกำหนดผู้เริ่มก่อน/หลังของ Game ถัดไป
-   ฝั่ง User ต้องสามารถเห็นว่าใน Pairing ปัจจุบันใครได้เริ่มก่อนและใครได้เริ่มหลัง

### คะแนน First / Second

``` text
First = 2
Second = 1
```

คะแนน First/Second สะสมต่อเนื่องในทุก Game ของ Tournament

เมื่อกำลังสร้าง Pairing ของ Game ถัดไป:

``` text
ถ้า First/Second Score ของผู้เล่น A > ผู้เล่น B
→ A ได้ Second
→ B ได้ First
```

ดังนั้นผู้ที่มีคะแนนสะสม First/Second สูงกว่าจะได้เริ่มหลัง
เพื่อให้เกิดการถ่วงดุลการเริ่มก่อน/หลัง

หากคะแนนของทั้งสองฝ่ายเท่ากัน ระบบสามารถสุ่มว่าใครจะได้ First หรือ Second

### User ต้องเห็น First / Second

เมื่อ User เปิด Current Pairing หรือดูผลประกบคู่ของ Round
ต้องแสดงสถานะการเริ่มก่อน/หลังใน Match นั้นเมื่อ Tournament เปิด Feature นี้

ตัวอย่าง:

``` text
Table 1

#15 Somchai
W 4 · T 1 · L 1 · Diff +120
FIRST

          VS

#27 Anan
W 3 · T 2 · L 1 · Diff +80
SECOND
```

สถานะ First / Second ต้องแสดงในฝั่ง User เพื่อให้ผู้เล่นทราบว่าใครเป็นฝ่ายเริ่มก่อน

ข้อมูล First / Second ยังคงเก็บใน Backend และใช้กับ Pairing Logic
แต่ไม่จำเป็นต้องแสดงเป็น Column หลักใน Scoreboard

## 12. Table และ QR Code

แต่ละโต๊ะในการแข่งขันจะมี QR Code ของตัวเอง โดย QR Code ผูกกับ Table และ
Tournament และ **ไม่จำเป็นต้องสร้าง QR Code ใหม่ทุกเกม**

เมื่อผู้เล่นสแกน QR Code ระบบต้องตรวจสอบอัตโนมัติจากข้อมูลของ Tournament, Table และ
Current Round ว่าขณะนั้นโต๊ะดังกล่าวกำลังมี Match ใดอยู่ และมีผู้เล่นคนใดอยู่ที่โต๊ะ

ดังนั้นผู้เล่นไม่จำเป็นต้องกรอก Tournament Player ID เพื่อบอกว่าโต๊ะนี้มีใครบ้างอีกครั้ง
เพราะระบบสามารถดึงข้อมูล Pairing ของ Round ปัจจุบันมาแสดงให้โดยอัตโนมัติ

ตัวอย่าง Flow:

``` text
Scan Table QR
    ↓
Detect Tournament
    ↓
Detect Current Round
    ↓
Detect Table
    ↓
Detect Players
    ↓
Open Match
```

QR Code เดิมของ Table สามารถใช้ตลอด Tournament

------------------------------------------------------------------------

## 13. การกรอกคะแนนและการ Confirm ผลการแข่งขัน

หลังจากผู้เล่นแข่งเสร็จ ผู้เล่นแต่ละฝ่ายสามารถกรอกคะแนนของตัวเองผ่านหน้า Match
ที่ได้จากการสแกน QR

ระบบต้องไม่ยอมรับผลการแข่งขันจากผู้เล่นเพียงคนเดียวทันที
เนื่องจากผู้เล่นฝ่ายหนึ่งอาจกรอกคะแนนไม่ตรงกับอีกฝ่าย

เมื่อมีการ Submit ผล ให้ระบบแสดง Confirmation Popup โดยสรุปผลที่ระบบกำลังจะบันทึก
เช่น ผู้เล่นคนไหนชนะ/เสมอ/แพ้ และคะแนนเท่าไหร่ต่อเท่าไหร่

ผู้เล่นทั้งสองฝ่ายต้อง Confirm ผลการแข่งขัน

หากผู้เล่นสองฝ่ายกรอกคะแนนไม่ตรงกัน ระบบต้องไม่เลือกผลของฝ่ายใดฝ่ายหนึ่งเอง
แต่ต้องแสดงสถานะ Score Conflict และให้ Admin ตรวจสอบหรือแก้ไขจากหลังบ้าน

------------------------------------------------------------------------

## 14. Admin Scoreboard และการแก้ไขคะแนน

Admin ต้องมีหน้า Scoreboard สำหรับดูคะแนนรวมของผู้เล่นทั้งหมดใน Tournament

ข้อมูลหลักประกอบด้วย:

-   ชื่อ
-   W/T/L ของแต่ละ Round
-   คะแนนสะสม
-   คะแนนที่ผู้เล่นทำได้
-   คะแนนของคู่แข่ง
-   ผลต่างของเกม
-   ผลต่างสะสม
-   First / Second
-   Table

Admin สามารถแก้ไขคะแนนหรือผลการแข่งขันจากหน้านี้ได้ เพื่อแก้กรณี Score Conflict
หรือกรณีที่ต้องแก้ไขข้อมูลการแข่งขันโดย Admin

ข้อมูลที่แก้โดย Admin ต้องถูกนำไปคำนวณ Scoreboard และสถิติของผู้เล่นตาม Logic
เดิมของระบบ

------------------------------------------------------------------------

## 15. การจัดการผู้เล่นก่อนและระหว่าง Tournament

ก่อน Tournament เริ่ม Admin สามารถลบหรือ Remove ผู้เล่นออกจาก Tournament ได้ เช่น
กรณี Import รายชื่อผิดหรือผู้เล่นไม่เข้าร่วม

ระหว่าง Tournament หากผู้เล่นแข่งไปแล้วและภายหลังกลับก่อนหรือไม่สามารถแข่งต่อได้
ให้ใช้สถานะ **Withdrawn** แทนการลบผู้เล่นออกจาก Tournament

เมื่อผู้เล่นถูก Withdraw ระบบจะไม่นำผู้เล่นคนนั้นไป Pairing ใน Round ต่อไป
แต่จะไม่ลบผู้เล่นออกจาก Tournament และไม่ลบประวัติการแข่งขันเดิม

ดังนั้น:

``` text
Withdraw ≠ Delete
```

ผู้เล่นที่ Withdraw ยังคงปรากฏในสรุป Tournament และยังมีข้อมูลจำนวนเกมที่เล่น, W/T/L,
คะแนนสะสม และผลต่างสะสมตามผลการแข่งขันที่เกิดขึ้นจริงก่อนออกจากการแข่งขัน

------------------------------------------------------------------------

## 16. โครงสร้างหน้า Admin

หลังจาก Login เข้า Admin แล้ว แนะนำให้มี Sidebar สำหรับจัดการระบบ เช่น:

``` text
Dashboard

Players
  └── All Players

Tournaments
  ├── All Tournaments
  └── Create Tournament

Staff
  └── Staff Assignments

Account Requests

Admins
```

เมื่อ Admin เข้าไปใน Tournament หนึ่งรายการ จะมีเมนูของ Tournament เช่น:

``` text
Tournament Overview
Players
Pairing
Scoreboard
Rounds
Tables / QR
Settings
```

หน้า Tournament Players ใช้สำหรับดูผู้เล่นใน Tournament, Tournament Player ID,
Global Player ID, ชื่อ และสถานะ Active / Withdrawn

หน้า Staff Assignment ใช้สำหรับ Admin เพิ่ม User เป็น Staff ของ Tournament
และถอด Staff ออกจาก Tournament โดย Staff จะเห็นเฉพาะ Tournament
ที่ได้รับมอบหมาย

หน้า Pairing ใช้สำหรับ Generate Pairing, เลือก Pairing Method, กำหนด Max
Diff Cap และ Drag & Drop แก้คู่ก่อน Confirm

หน้า Scoreboard ใช้สำหรับดูและแก้ไขคะแนน

หน้า Tables / QR ใช้สำหรับจัดการ Table และ QR Code

หน้า Rounds ใช้สำหรับดูผลการแข่งขันแต่ละ Round

------------------------------------------------------------------------

## 17. โครงสร้างหน้า Public / User

หน้า Public สามารถออกแบบ Flow ประมาณนี้:

``` text
Home
│
├── Tournament List
│
├── Tournament Detail
│   ├── Current Pairing
│   │   └── First / Second (ถ้า Tournament เปิดใช้งาน)
│   ├── Scoreboard
│   ├── Round Results
│   └── Player Search
│
├── Player
│   └── Player History
│
└── User
    ├── Google Login
    ├── Link Player ID
    ├── Profile
    └── My Tournament History
```

ผู้ใช้ที่ไม่ Login สามารถดู Tournament และผลการแข่งขันได้ตามปกติ

ผู้ใช้ที่ Login ด้วย Google สามารถใช้ Feature เพิ่มเติมที่เกี่ยวข้องกับ Profile
และประวัติของตัวเองได้

------------------------------------------------------------------------

## 18. Development Phase

### Phase 1 --- Tournament Core และ UX/UI หลัก

Phase แรกเน้นสร้าง Prototype ของระบบการแข่งขันหลักทั้งหมด ได้แก่ Public
Tournament List, Tournament Detail, Current Pairing, Scoreboard, Round
History และ Player Search รวมถึงฝั่ง Admin สำหรับ Login, Dashboard, Create
Tournament, Tournament Settings, Player Management ภายใน Tournament,
Pairing, Pairing Preview, Drag & Drop Pairing, Scoreboard และ Table/QR

ใน Phase นี้ต้องครอบคลุม Tournament Mode ทั้ง Competition และ Practice รวมถึง
Toggle จำนวนผู้เล่น, Toggle จำนวนเกม, Toggle First / Second, Default
Maximum Score สำหรับ Game, Maximum Score ต่อ Game, Pairing Method และ Max
Diff Cap ต่อ Round/Game

รวมถึง Role และ Permission Scope สำหรับ Admin / Staff โดย Staff ต้องถูกจำกัด
ให้เห็นเฉพาะ Tournament ที่ Admin มอบหมาย

Flow หลัก:

``` text
Create Tournament
        ↓
Add / Import Players
        ↓
Generate Pairing
        ↓
Preview Pairing
        ↓
Drag & Drop แก้ Pairing
        ↓
Confirm Pairing
        ↓
Display Current Pairing
        ↓
Display Scoreboard
```

### Phase 2 --- Match Flow และ Player Management

Phase ที่สองเน้น Flow ของการแข่งขันจริง ตั้งแต่ Table QR, Scan QR, ตรวจสอบ
Current Round และผู้เล่นที่อยู่โต๊ะนั้น ไปจนถึง Submit Score และระบบ Confirm
จากผู้เล่นทั้งสองฝ่าย

รวมถึง Score Conflict, Admin Score Editing, Player Import, Global Player
ID, Tournament Player ID, Global Player Management, Player Detail,
Tournament History, Match History, Remove Player ก่อนเริ่ม Tournament และ
Withdraw Player ระหว่าง Tournament

Flow หลัก:

``` text
Table QR
    ↓
Scan
    ↓
Detect Tournament / Round / Table
    ↓
Detect Players
    ↓
Submit Score
    ↓
Both Players Confirm
    ↓
Result Confirmed
    ↓
Update Scoreboard
    ↓
Save Match History
```

### Phase 3 --- Account System, UX Polish และ Deployment

Phase ที่สามเพิ่ม Feature ที่ไม่จำเป็นต่อการดู Tournament แต่ช่วยให้ระบบสมบูรณ์มากขึ้น
ได้แก่ Google Login สำหรับ User, Link Google Account กับ Global Player ID,
Admin Approval สำหรับ Account Link Request, User Profile, My Tournament
History และ My Match History

รวมถึง Admin Management เช่น การเพิ่ม Admin ด้วย Gmail, Staff Management, การ
Assign Staff ให้ Tournament และหน้า Account Requests

หลังจาก Core Function ทำงานแล้วจึงค่อยทำ UX/UI Polish เช่น Responsive Design,
Mobile QR Flow, Loading State, Empty State, Error State, Confirmation
Dialog, Toast, Score Conflict State, Withdraw State และ Tournament
Completed State

ส่วน Deployment ให้เน้นบริการ Free Tier เป็นหลัก
โดยสามารถพิจารณาโครงสร้างประมาณ:

``` text
Frontend
    ↓
Vercel

Backend
    ↓
Render

Database
    ↓
Neon PostgreSQL
```

หรือเปลี่ยน Database เป็น MongoDB ได้ตามความเหมาะสมของโครงสร้าง Backend
และข้อมูลจริง

Deployment ไม่ใช่ Core ของ Prototype ใน Phase แรก
แต่เป็นส่วนของการนำระบบไปใช้งานจริงใน Phase 3

------------------------------------------------------------------------

## 19. Logic และ Permission ที่ต้องคงเดิมและห้ามเปลี่ยน

ส่วนต่อไปนี้เป็น Core Requirement ที่ต้องถือเป็นกติกาหลักระหว่างการพัฒนา

### Scoring

``` text
W = 2
T = 1
L = 0
```

### Bye

``` text
W = 2
Diff = +100
```

### Maximum Score

Maximum Score เป็น **Setting ระดับ Game/Match**

Default ของ Game ใหม่คือ:

``` text
350
```

แต่แต่ละ Game สามารถ:

``` text
Maximum Score = 350
Maximum Score = 250
Maximum Score = OFF
```

ได้อย่างอิสระ แม้อยู่ใน Tournament เดียวกัน

ห้ามตีความว่า Maximum Score เป็นค่าเดียวของ Tournament

### First / Second

First / Second เป็น Feature ที่เปิดหรือปิดได้ตอนสร้าง Tournament

ถ้าเปิด:

``` text
First = 2
Second = 1
```

สะสมต่อเนื่องทุก Game

ถ้าคะแนนสะสมไม่เท่ากัน:

``` text
คะแนน First/Second สูงกว่า → Second
คะแนน First/Second ต่ำกว่า → First
```

ถ้าเท่ากัน ระบบสามารถสุ่ม First / Second

ถ้า Feature ถูกปิด ระบบไม่ต้องใช้ First / Second Logic

เมื่อเปิด Feature นี้ ข้อมูล First / Second ต้องแสดงใน Current Pairing / Pairing
Result ฝั่ง User เพื่อให้รู้ว่าใครเริ่มก่อนหรือหลัง

### Pairing

ต้องรองรับ:

``` text
Random
Swiss
King of the Hill
Round Robin
```

และต้องใช้ Logic ตาม Requirement ที่กำหนดไว้เดิม

Pairing ต้องพิจารณาข้อมูลการแข่งขันที่ Confirmed แล้ว และต้องไม่นำผู้เล่น ที่ Withdrawn
ไป Pairing

### Pairing Preview

Preview ต้องแสดง:

``` text
Tournament Player ID / Name
WTL
Cumulative Difference
First / Second (ถ้าเปิด Feature)
```

โดย WTL และ Cumulative Difference แสดงเป็นข้อมูลขนาดเล็กใต้ชื่อหรือ ID

### Max Diff Cap

Max Diff Cap เป็น Setting ของ Pairing/แต่ละ Round/Game
และสามารถกำหนดแตกต่างกันได้

### Withdraw

การ Withdraw ผู้เล่นระหว่าง Tournament หมายถึงผู้เล่นจะไม่ถูกนำไป Pairing ในอนาคต
แต่ข้อมูลการแข่งขันเดิมยังคงอยู่ และผู้เล่นยังต้องปรากฏในสรุป Tournament

``` text
Withdraw ≠ Delete
```

### Permission

``` text
Admin
├── All Tournaments
├── All Players
├── Create Tournament
├── Manage Admins
├── Manage Staff
└── Full Tournament Access

Staff
├── Assigned Tournaments Only
├── Tournament Players
├── Pairing
├── Scoreboard
├── Rounds
├── Tables / QR
└── Tournament Settings

Staff ✕ Global Players
Staff ✕ Other Tournaments
Staff ✕ Create Tournament
Staff ✕ Manage Admins
Staff ✕ Manage Staff
```

Backend ต้องบังคับ Permission และ Tournament Scope ทุก Request

## 20. แนวคิด Data Model ที่ต้องรองรับ

เพื่อไม่ให้ Role และ Scoring ถูกผูกผิดระดับ โครงสร้างข้อมูลควรแยก Scope ให้ชัดเจน

``` text
User
 ├── role: ADMIN / STAFF / USER
 └── ...

Tournament
 ├── ...
 └── useFirstSecond

TournamentStaff
 ├── userId
 ├── tournamentId
 └── status

Game / Match
 ├── tournamentId
 ├── roundId
 ├── maximumScoreEnabled
 ├── maximumScore
 ├── maxDiffCap
 ├── firstPlayerId
 └── secondPlayerId
```

จุดสำคัญ:

-   `Tournament.useFirstSecond` เป็น Setting ของ Tournament
-   `Game.maximumScoreEnabled` และ `Game.maximumScore` เป็น Setting
    ของแต่ละ Game
-   `Game.maxDiffCap` เป็น Setting ของ Pairing/เกมตาม Requirement
-   `TournamentStaff` เป็นความสัมพันธ์ระหว่าง User กับ Tournament
-   สิทธิ์ Staff ต้องตรวจจาก `userId + tournamentId` ทุกครั้งที่เข้าถึง Resource
    ของ Tournament

ห้ามเก็บ `maximumScore` เพียงค่าเดียวบน Tournament แล้วนำไปใช้กับทุก Game

------------------------------------------------------------------------

## 21. หลักสำคัญของ UX/UI

ระบบควรออกแบบให้ User ที่ไม่ได้ Login สามารถเข้าเว็บแล้วเข้าใจสถานะการแข่งขันได้ทันที
โดยไม่ต้องมีขั้นตอนสมัครสมาชิกหรือสมัคร Tournament

ส่วน Admin จะเป็นผู้ควบคุมข้อมูลการแข่งขันทั้งหมด ตั้งแต่การสร้าง Tournament, Import
ผู้เล่น, จัด Pairing, แก้ Pairing, จัดการ Table, ตรวจสอบผลการแข่งขัน
และแก้ไขคะแนน รวมถึงการกำหนด Staff ให้กับ Tournament

Staff จะทำงานได้ครบในขอบเขต Tournament ที่ได้รับมอบหมาย แต่จะไม่สามารถเข้าถึง
Global Player, Tournament อื่น, การสร้าง Tournament หรือการจัดการ Admin/Staff

Google Login เป็น Feature เสริมสำหรับผู้ที่ต้องการผูกบัญชีเข้ากับ Global Player ID
และดูประวัติของตัวเอง ไม่ควรเป็นข้อบังคับสำหรับการดู Tournament

การออกแบบ UI สามารถปรับรูปแบบการแสดงผลได้ แต่ **ห้ามเปลี่ยน Logic การคิดคะแนน,
Bye, First/Second, Pairing, Permission Scope และกติกา Max Diff Cap
ที่ระบุไว้**

Maximum Score ต้องถูกออกแบบเป็น **ค่าเริ่มต้น/Setting ของแต่ละ Game**
ไม่ใช่ค่าถาวรเพียงค่าเดียวของ Tournament
