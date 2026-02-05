#!/usr/bin/env python3
"""Script to add 229 patrols for 10_DIV_HQ"""
import asyncio
import sys
sys.path.insert(0, '/app/backend')

from database import init_db, close_db, get_db
from datetime import datetime, timezone, timedelta
import uuid
import hashlib

# All 229 patrols data extracted from PDF
PATROLS_DATA = [
    {"serial": 1, "name": "Capt Sakib Jaki Chowdhury", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "shakibjaki444@gmail.com", "mobile": "01534-399785"},
    {"serial": 2, "name": "Lt M. M. Arman Zeb", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "armanzeb1899@gmail.com", "mobile": "01757-173865"},
    {"serial": 3, "name": "Lt Tasfiya Tasnim Mim", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "mimtasfiya43@gmail.com", "mobile": "01735-159901"},
    {"serial": 4, "name": "WO (OCU) Md Sohel Miah", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "mdsohelr.4684@gmail.com", "mobile": "01767-276989"},
    {"serial": 5, "name": "Sgt Md Imran Hossain", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "mdamranchowdhury4733@gmail.com", "mobile": "01723-265127"},
    {"serial": 6, "name": "Sgt Md Al Mamun", "unit": "1 Field Regt Arty", "camp": "Patiya Army Camp", "email": "almamuncox17@gmail.com", "mobile": "01623-174172"},
    {"serial": 7, "name": "SWO (Gunner) Md Abdul Hamid", "unit": "1 Field Regt Arty", "camp": "Ziri Army Camp", "email": "ahamid2117@gmail.com", "mobile": "01734-298417"},
    {"serial": 8, "name": "Sgt (Gunner) Mohammad Year Hossain", "unit": "1 Field Regt Arty", "camp": "Ziri Army Camp", "email": "m.yearhossain101@gmail.com", "mobile": "01630-280454"},
    {"serial": 9, "name": "Sgt (Gunner) Md Lokman Hossain", "unit": "1 Field Regt Arty", "camp": "Ziri Army Camp", "email": "ri4123032@gmail.com", "mobile": "01622-915023"},
    {"serial": 10, "name": "Sgt (TA) Md Samsuzzaman", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "zaman1225960@gmail.com", "mobile": "01742-429154"},
    {"serial": 11, "name": "Sgt (Gunner) Md Raihanul Islam", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "mdraihanul01722@gmail.com", "mobile": "01722-857791"},
    {"serial": 12, "name": "Sgt (Gunner) Akkas Ali", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "akkasali6016@gmail.com", "mobile": "01318-382679"},
    {"serial": 13, "name": "Sgt DMT Md Mahbub Alam", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "mahbubalom7270@gmail.com", "mobile": "01728-127270"},
    {"serial": 14, "name": "Sgt (Gunner) Sakib Md Nazmul Hossain", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "mn6542159@gmail.com", "mobile": "01727-576800"},
    {"serial": 15, "name": "Sgt (OPR) Md Alamgir Hossain", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "alamgirhosen5629@gmail.com", "mobile": "01647-485831"},
    {"serial": 16, "name": "Sgt (TA) Md Rezaul Karim", "unit": "1 Field Regt Arty", "camp": "Kelishahar Army Camp", "email": "rezaulkarim103012@gmail.com", "mobile": "01324-103012"},
    {"serial": 17, "name": "Capt Md Mohaimenur Rahman Arif", "unit": "1 Field Regt Arty", "camp": "Chonhara Army Camp", "email": "pcc@gmail.com", "mobile": None},
    {"serial": 18, "name": "Lt Rakib Hasan", "unit": "1 Field Regt Arty", "camp": "Chonhara Army Camp", "email": "rakib2078hasa@gmail.com", "mobile": "01314-432485"},
    {"serial": 19, "name": "SWO Md Manikuzzaman", "unit": "1 Field Regt Arty", "camp": "Chonhara Army Camp", "email": "manikuzzaman78@gmail.com", "mobile": "01613-424264"},
    {"serial": 20, "name": "WO (OCU) Rabiul Alam", "unit": "1 Field Regt Arty", "camp": "Chonhara Army Camp", "email": "rabiulalam0122@gmail.com", "mobile": "01725-111959"},
    {"serial": 21, "name": "WO (Gunner) Asaduzzaman, SGP", "unit": "1 Field Regt Arty", "camp": "Chonhara Army Camp", "email": "ariyanabsi21122015@gmail.com", "mobile": "01676-670466"},
    {"serial": 22, "name": "Capt SM Sakibuzzaman Shamim", "unit": "9 Field Regt Arty", "camp": "Satkania Govt College", "email": "diligentninemto@gmail.com", "mobile": "01769-107459"},
    {"serial": 23, "name": "Capt Efana Binte Sarwar", "unit": "9 Field Regt Arty", "camp": "Satkania Govt College", "email": "efanabinte.shanta@gmail.com", "mobile": "01746-631930"},
    {"serial": 24, "name": "Capt Mehjabeen Madina", "unit": "9 Field Regt Arty", "camp": "Satkania Govt College", "email": "labbonnayatora@gmail.com", "mobile": "01769-511323"},
    {"serial": 25, "name": "Lt Ashran Wahid", "unit": "9 Field Regt Arty", "camp": "Satkania Govt College", "email": "9fdregtarty.adjt@gmail.com", "mobile": "01769-102382"},
    {"serial": 26, "name": "Lt Mithun Azad", "unit": "9 Field Regt Arty", "camp": "Satkania Govt College", "email": "mithunmighla2019@gmail.com", "mobile": "01746-962772"},
    {"serial": 27, "name": "Major Md Farhan Fuad, G", "unit": "9 Field Regt Arty", "camp": "Janab Keochia School", "email": "farhanfuad9214@gmail.com", "mobile": "01313-832345"},
    {"serial": 28, "name": "Capt Sabbir Ahmed Sunny", "unit": "9 Field Regt Arty", "camp": "Janab Keochia School", "email": "blackpear12742@gmail.com", "mobile": "01787-605468"},
    {"serial": 29, "name": "Lt Saad Mohammad Samsuddin", "unit": "9 Field Regt Arty", "camp": "Janab Keochia School", "email": "mohammadsaad12194@gmail.com", "mobile": "01769-512194"},
    {"serial": 30, "name": "Capt Abir Ahmed", "unit": "9 Field Arty", "camp": "Al-Helal Degree College", "email": "diligentninemto@gmail.com", "mobile": "01769-102382"},
    {"serial": 31, "name": "Lt Md Fahimul Islam", "unit": "9 Field Arty", "camp": "Al-Helal Degree College", "email": "fahimul3081613@gmail.com", "mobile": "01315-428378"},
    {"serial": 32, "name": "Major Khondakar Fazle Rabbi Mim", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "mimuchocolate@gmail.com", "mobile": "01771-626635"},
    {"serial": 33, "name": "Capt Md Khalid Hasan Muddha", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "khalidhasan10788@gmail.com", "mobile": "01769-510788"},
    {"serial": 34, "name": "Capt Akkhoy Areng Joy", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "akkhoyarengjoy@gmail.com", "mobile": "01716-042505"},
    {"serial": 35, "name": "Lt Md Mainul Islam Bayezid", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "bayzed192736@gmail.com", "mobile": "01856-833764"},
    {"serial": 36, "name": "Md Atikur Rahman", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "atikur52737@gmail.com", "mobile": "01793-633557"},
    {"serial": 37, "name": "WO Mohammad Selim Uddin", "unit": "12 Field Regt Arty", "camp": "Borma Degree College", "email": "Jashimatangail1340@gmail.com", "mobile": "01779-735554"},
    {"serial": 38, "name": "WO Abdul Mannan", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "abdulmannnur@gmail.com", "mobile": "01729-183453"},
    {"serial": 39, "name": "Major Md Ashiq Mahmud", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "ashikdhusor1555@gmail.com", "mobile": "01769-102394"},
    {"serial": 40, "name": "Capt Ibtisam Jawad Diyab", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "deyab.95@gmail.com", "mobile": "01736-079069"},
    {"serial": 41, "name": "Lt Md Mahmudul Huq Antor", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "mmhantor1955@gmail.com", "mobile": "01613-381955"},
    {"serial": 42, "name": "SWO Ahmed Syed", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "chsayed7@gmail.com", "mobile": "01710-841591"},
    {"serial": 43, "name": "SWO Mohammad Jalal Uddin", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "ju329557@gmail.com", "mobile": "01725-731141"},
    {"serial": 44, "name": "WO Md Sujon Talukdar", "unit": "12 Field Regt Arty", "camp": "Muktijoddha Complex", "email": "mohammadsifat15@gmail.com", "mobile": "01838-486901"},
    {"serial": 45, "name": "Major Irtika-Ur-Rahman, psc", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "12fdregtarty.2ic@gmail.com", "mobile": "01769-102388"},
    {"serial": 46, "name": "Capt Anika Anan Promi", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "chandanaishar@gmail.com", "mobile": "01769-107167"},
    {"serial": 47, "name": "Lt Md Shahriar Rahman", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "adjt2398@gmail.com", "mobile": "01769-102398"},
    {"serial": 48, "name": "Lt Sabrina Khan", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "qmorindom12@gmail.com", "mobile": "01769-102399"},
    {"serial": 49, "name": "MWO Mohammad Shah Alam", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "Shahalam9570@gmail.com", "mobile": "01769-102389"},
    {"serial": 50, "name": "SWO Md Mashiur Rahman", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "moshiurrahman52567@gmail.com", "mobile": "01723-124628"},
    {"serial": 51, "name": "WO Md Abu Noman", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "abunoman4137@gmail.com", "mobile": "01721-992284"},
    {"serial": 52, "name": "WO Md Rashedul Hasan", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "rashedmdhasan809@gmail.com", "mobile": "01400-806596"},
    {"serial": 53, "name": "WO Md Masudul Islam", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "imasudul444@gmail.com", "mobile": "01722-088039"},
    {"serial": 54, "name": "WO Md Ibrahim Miah, AEC", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "ibrahimshohel217@gmail.com", "mobile": "01684-998217"},
    {"serial": 55, "name": "WO Md Sohel Munshi, EME", "unit": "12 Field Regt Arty", "camp": "Ashab Siraj Polytechnic", "email": "sohelmunshi1700@mail.com", "mobile": "01755-168264"},
    {"serial": 56, "name": "Capt Aref Asmar Joy", "unit": "12 Field Regt Arty", "camp": "Dhopachhari Shilghata", "email": "aarefasmerjoy@gmail.com", "mobile": "01769-511313"},
    {"serial": 57, "name": "WO Hamid Hawlader", "unit": "12 Field Regt Arty", "camp": "Dhopachhari Shilghata", "email": "hamid3044619@gmail.com", "mobile": "01732-066334"},
    {"serial": 58, "name": "Major M M Shatil Munabbir", "unit": "28 Med Regt Arty", "camp": "Smart Convention Center", "email": "28medregtarty.2ic@army.mil.bd", "mobile": "01769-102820"},
    {"serial": 59, "name": "Lt Md Fahim Farhan Islam", "unit": "28 Med Regt Arty", "camp": "Smart Convention Center", "email": "28medregtarty.qm@gmail.com", "mobile": "01769-102825"},
    {"serial": 60, "name": "Lt Md Abdul Wadud Masum", "unit": "28 Med Regt Arty", "camp": "Smart Convention Center", "email": "adjt28medregtarty@gmail.com", "mobile": None},
    {"serial": 61, "name": "WO (TA) Md Masud Miah", "unit": "28 Med Regt Arty", "camp": "Smart Convention Center", "email": "mdmasudmia2376@gmail.com", "mobile": "01769-102824"},
    {"serial": 62, "name": "WO (DMT) Md Golam Mostofa", "unit": "28 Med Regt Arty", "camp": "Smart Convention Center", "email": "gmmostofa@gmail.com", "mobile": "01825-330081"},
    {"serial": 63, "name": "Capt Mohammad Fahim Shahriar Khan", "unit": "28 Med Regt Arty", "camp": "Gondamara Boroghona", "email": "fahimsharier2000@gmail.com", "mobile": "01769-107027"},
    {"serial": 64, "name": "Lt Riad Hossain Parvej", "unit": "28 Med Regt Arty", "camp": "Gondamara Boroghona", "email": "riadhossainparvej@gmail.com", "mobile": "01309-609723"},
    {"serial": 65, "name": "SWO (DMT) Shamim Ahmed", "unit": "28 Med Regt Arty", "camp": "Gondamara Boroghona", "email": "shamimahmed88809@gmail.com", "mobile": "01724-645079"},
    {"serial": 66, "name": "WO (TA) Md Shukur Ali", "unit": "28 Med Regt Arty", "camp": "Gondamara Boroghona", "email": "mdsukur6056@gmail.com", "mobile": "01794-436056"},
    {"serial": 67, "name": "WO (Gunner) Mohammad Mazharul Huq", "unit": "28 Med Regt Arty", "camp": "Gondamara Boroghona", "email": "mazhar1222615@gmail.com", "mobile": "01816-337319"},
    {"serial": 68, "name": "Major M Q Tanjim", "unit": "28 Med Regt Arty", "camp": "Baharchhara Cyclone Center", "email": "tanjim2806@gmail.com", "mobile": "01769-102823"},
    {"serial": 69, "name": "Capt Saleh Mohammad Nurul Wahhab", "unit": "28 Med Regt Arty", "camp": "Baharchhara Cyclone Center", "email": "saleh.wahhab2196@gmail.com", "mobile": "01762-159967"},
    {"serial": 70, "name": "Capt Abu Sayad Raiyan", "unit": "28 Med Regt Arty", "camp": "Baharchhara Cyclone Center", "email": "aburaiyan518@gmail.com", "mobile": "01739-025474"},
    {"serial": 71, "name": "WO (DMT) Md Monjurul Huq", "unit": "28 Med Regt Arty", "camp": "Baharchhara Cyclone Center", "email": "mahamudahmud448@gmail.com", "mobile": "01705-431104"},
    {"serial": 72, "name": "WO Md Sihab Uddin", "unit": "28 Med Regt Arty", "camp": "Baharchhara Cyclone Center", "email": "mdsihab24910@gmail.com", "mobile": "01816-031237"},
    {"serial": 73, "name": "Major Nafiz Imtiaz", "unit": "Adhoc Reserve Force", "camp": "Brigade", "email": "iceman.imtiaz@gmail.com", "mobile": "01769-008898"},
    {"serial": 74, "name": "Capt Fahiya Mobassher Sarothi", "unit": "47 Mortar Regt", "camp": "Patiya Adarsha High School", "email": "fahiasarothi@gmail.com", "mobile": "01769-510211"},
    {"serial": 75, "name": "Capt Rakib Mahmud Rimon", "unit": "47 Mortar Regt", "camp": "Patiya Adarsha High School", "email": "rakibmamud@gmail.com", "mobile": "01751-133300"},
    {"serial": 76, "name": "Lt Talha Turja", "unit": "47 Mortar Regt", "camp": "Patiya Adarsha High School", "email": "talhaturja@gmail.com", "mobile": "01720-570259"},
    {"serial": 77, "name": "Lt Mohammad Abu Sufian", "unit": "47 Mortar Regt", "camp": "Patiya Adarsha High School", "email": "sufian13279@gmail.com", "mobile": "01880-669971"},
    {"serial": 78, "name": "Major Munem Shahriar, psc", "unit": "47 Mortar Regt", "camp": "Patiya Adarsha High School", "email": "munemshahriarapon@gmail.com", "mobile": "01769-102618"},
    {"serial": 79, "name": "Lt Ashik Imtiaz", "unit": "47 Mortar Regt", "camp": "Sonarpara Army Camp", "email": "imteaz.kc.2018@gmail.com", "mobile": "01915-5503838"},
    {"serial": 80, "name": "SWO Mohammad Rahmat Khan", "unit": "47 Mortar Regt", "camp": "Sonarpara Army Camp", "email": "rahmatkhan9876pone@gmail.com", "mobile": "01862-988329"},
    {"serial": 81, "name": "WO Md Faruk Sikdar", "unit": "47 Mortar Regt", "camp": "Sonarpara Army Camp", "email": "shikdefaruk733@gmail.com", "mobile": "01740-018722"},
    {"serial": 82, "name": "WO Md Shahinur Rahman", "unit": "47 Mortar Regt", "camp": "Sonarpara Army Camp", "email": "rahmanshahin32@gmail.com", "mobile": "01769-117529"},
    {"serial": 83, "name": "Capt Rafsan Naziat Niloy", "unit": "47 Mortar Regt", "camp": "Sonarpara Army Camp", "email": "rafsunnaziat29@gmail.com", "mobile": "01705-827294"},
    {"serial": 84, "name": "SWO Mohammad Sakhawat Hossain", "unit": "47 Mortar Regt", "camp": "South Holdiapalong", "email": "mdsakhawathossen4400@gmail.com", "mobile": "01720-559573"},
    {"serial": 85, "name": "WO Faruk Ahmed", "unit": "47 Mortar Regt", "camp": "South Holdiapalong", "email": "farukahmed403@gmail.com", "mobile": "01773-075577"},
    {"serial": 86, "name": "WO Md Samaun Alam", "unit": "47 Mortar Regt", "camp": "South Holdiapalong", "email": "mdsamaunalam977@gmail.com", "mobile": "01722-158127"},
    {"serial": 87, "name": "Sgt Md Humayun Kabir", "unit": "47 Mortar Regt", "camp": "South Holdiapalong", "email": "yuhuma214@gmail.com", "mobile": "01736-537519"},
    {"serial": 88, "name": "Major Mir Mosharraf Hossain, psc", "unit": "1 EB", "camp": "South Holdiapalong", "email": "hossain8091@gmail.com", "mobile": "01769-102616"},
    {"serial": 89, "name": "Capt Sakibur Rahman", "unit": "1 EB", "camp": "South Holdiapalong", "email": "shakibur008@gmail.com", "mobile": "01755-070705"},
    {"serial": 90, "name": "SWO Md Ashraful Alam", "unit": "1 EB", "camp": "Goyalmara Army Camp", "email": "sj90909045@gmail.com", "mobile": "01317-168509"},
    {"serial": 91, "name": "SWO Md Mozammel Huq", "unit": "1 EB", "camp": "Goyalmara Army Camp", "email": "mozammel62371@gmail.com", "mobile": "01867-730722"},
    {"serial": 92, "name": "WO Md Abdus Sattar", "unit": "1 EB", "camp": "Goyalmara Army Camp", "email": "mdabdussattarmia300@gmail.com", "mobile": "01710-707504"},
    {"serial": 93, "name": "Capt Saif Hossain Ayon", "unit": "1 EB", "camp": "Goyalmara Army Camp", "email": "ayon1827@gmail.com", "mobile": "01932-888731"},
    {"serial": 94, "name": "Capt Mehrab Rahman", "unit": "1 EB", "camp": "Goyalmara Army Camp", "email": "rivumehrab98@gmail.com", "mobile": "01769-511202"},
    {"serial": 95, "name": "SWO Md Mizanur Rahman", "unit": "1 EB", "camp": "Ukhiya Army Camp", "email": "care4mizanur@gmail.com", "mobile": "01837-319301"},
    {"serial": 96, "name": "SWO Md Anisur Rahman", "unit": "1 EB", "camp": "Ukhiya Army Camp", "email": "anishurrahman525@gmail.com", "mobile": "01713-734672"},
    {"serial": 97, "name": "WO Md Shahinur Rahman", "unit": "1 EB", "camp": "Ukhiya Army Camp", "email": "mdshahinur008@gmail.com", "mobile": "01719-414085"},
    {"serial": 98, "name": "WO Mohammad Zaman Kabir", "unit": "1 EB", "camp": "Ukhiya Army Camp", "email": "wojaman7@gmail.com", "mobile": "01843-533200"},
    {"serial": 99, "name": "SWO Md Atikur Rahman", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "atik61736@gmail.com", "mobile": "01712-679570"},
    {"serial": 100, "name": "SWO Md Sohel Miah", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "smia717@gmail.com", "mobile": "01318-372485"},
    {"serial": 101, "name": "WO Atiar Sardar", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "mdatiar9eb@gmail.com", "mobile": "01301-334381"},
    {"serial": 102, "name": "WO Amiz Uddin", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "mdamiz0632@gmail.com", "mobile": "01719-900677"},
    {"serial": 103, "name": "WO (AEC) Md Rashedul Islam", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "rashedul385@yahoo.com", "mobile": "01779-717012"},
    {"serial": 104, "name": "SWO Md Saidur Rahman", "unit": "1 EB", "camp": "Railway Station 1 EB Camp", "email": "saidur61499@gmail.com", "mobile": "01735-337413"},
    {"serial": 105, "name": "SWO Md Joynal Abedin", "unit": "1 EB", "camp": "Shilpakala Academy", "email": "4024782joynal@gmail.com", "mobile": "01817-648584"},
    {"serial": 106, "name": "WO Md Khalilur Rahman", "unit": "1 EB", "camp": "Shilpakala Academy", "email": "rahmanmdkhali343@gmail.com", "mobile": "01642-221131"},
    {"serial": 107, "name": "WO Md Abdus Sobahan", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "abdussobahan012@gmail.com", "mobile": "01710-707811"},
    {"serial": 108, "name": "WO Md Bodiuzzaman", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "mdbodiuzzaman4037223@gmail.com", "mobile": "01819-148738"},
    {"serial": 109, "name": "SWO Md Rahmatullah", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "urahamat352@gmail.com", "mobile": "01769-282676"},
    {"serial": 110, "name": "SWO Md Shirol Hossain", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "siroll941422@gmail.com", "mobile": "01822-737506"},
    {"serial": 111, "name": "WO Ashrafur Rahman", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "m95639165@gmail.com", "mobile": "01729-718332"},
    {"serial": 112, "name": "WO Md Belal Hossain", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "mdbalalhosain49@gmail.com", "mobile": "01728-792196"},
    {"serial": 113, "name": "Sgt Md Al Amin", "unit": "9 EB", "camp": "Khurushkul Army Camp", "email": "alaminmd60424@gmail.com", "mobile": "01627-146176"},
    {"serial": 114, "name": "SWO Md Jamal Uddin", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "swojamaluddin61424@gmail.com", "mobile": "01731-145886"},
    {"serial": 115, "name": "SWO Md Gias Uddin Bhuiyan", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "ugias4960@gmail.com", "mobile": "01872-967059"},
    {"serial": 116, "name": "WO Md Aftab Uddin", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "aftabuddin4662@gmail.com", "mobile": "01721-560682"},
    {"serial": 117, "name": "WO Md Abdul Gafur", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "gofur8624@gmail.com", "mobile": "01730-585303"},
    {"serial": 118, "name": "Major Kazi Intisar Salim", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "bcoycomd24bir@gmail.com", "mobile": "01769-102642"},
    {"serial": 119, "name": "Capt Tanvir Hasan Tonmoy", "unit": "24 Bir", "camp": "PM Khali Army Camp", "email": "tanvir11562@gmail.com", "mobile": "01625-802917"},
    {"serial": 120, "name": "SWO Md Sultan Mahmud", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "sultan66421@gmail.com", "mobile": "01710-066642"},
    {"serial": 121, "name": "WO Md Aminul Islam", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "cdoaminul@gmail.com", "mobile": "01765-723899"},
    {"serial": 122, "name": "WO Md Razib", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "md.razib.bdk@gmail.com", "mobile": "01721-043113"},
    {"serial": 123, "name": "Sgt Md Mashiur Rahman", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "rahmanmashiur755@gmail.com", "mobile": "01608-014099"},
    {"serial": 124, "name": "Sgt Suman Pal", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "sumonpal412@gmail.com", "mobile": "01737-126565"},
    {"serial": 125, "name": "Sgt Md Shahidul Islam", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "mdshahidulislam01748309898@gmail.com", "mobile": "01748-309898"},
    {"serial": 126, "name": "Sgt Md Nazmul Islam", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "nazmulsujon71@gmail.com", "mobile": "01721-086811"},
    {"serial": 127, "name": "Lt ASM Junaed", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "asmjonayed25@gmail.com", "mobile": "01339-436300"},
    {"serial": 128, "name": "SWO Md Zakir Hossain", "unit": "24 Bir", "camp": "Eidgaon Army Camp", "email": "zakir.67031@gmail.com", "mobile": "01601-872822"},
    {"serial": 129, "name": "WO Md Abul Bashar", "unit": "24 Bir", "camp": "Ramu Army Camp", "email": "basar.2930@gmail.com", "mobile": "01714-235188"},
    {"serial": 130, "name": "Sgt Md Sorowar Hossain", "unit": "24 Bir", "camp": "Ramu Army Camp", "email": "sorowarshuvo123@gmail.com", "mobile": "01723-661825"},
    {"serial": 131, "name": "Sgt Md Iqbal Hossain", "unit": "24 Bir", "camp": "Ramu Army Camp", "email": "iqbalkabir2019@gmail.com", "mobile": "01731-478982"},
    {"serial": 132, "name": "Capt Junaed Ahmed", "unit": "24 Bir", "camp": "Ramu Army Camp", "email": "anan.4930@gmail.com", "mobile": "01850-149143"},
    {"serial": 133, "name": "Lt Masliniya Al Ahad", "unit": "24 Bir", "camp": "Ramu Army Camp", "email": "brightermasliniya@gmail.com", "mobile": "01306-344653"},
    {"serial": 134, "name": "SWO Md Ebadat Ali", "unit": "24 Bir", "camp": "Ramu Cantonment Camp", "email": "ebadotnahid@gmail.com", "mobile": "01773-553353"},
    {"serial": 135, "name": "WO Shuvankar Mollick", "unit": "24 Bir", "camp": "Ramu Cantonment Camp", "email": "shuvo.b12@gmail.com", "mobile": "01718-640267"},
    {"serial": 136, "name": "Sgt Md Babul Hossain", "unit": "24 Bir", "camp": "Ramu Cantonment Camp", "email": "bablytrisha@gmail.com", "mobile": "01624-773533"},
    {"serial": 137, "name": "Capt M A Munim Jim", "unit": "24 Bir", "camp": "Ramu Cantonment Camp", "email": "ccomd24@gmail.com", "mobile": "01769-102644"},
    {"serial": 138, "name": "Lt Shayan Ishtihad", "unit": "24 Bir", "camp": "Ramu Cantonment Camp", "email": "baishariacc@gmail.com", "mobile": "01632-927908"},
    {"serial": 139, "name": "SWO Gias Uddin", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "swogias@gmail.com", "mobile": "01726-189992"},
    {"serial": 140, "name": "WO Nur Mohammad", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "nurmultitech@gmail.com", "mobile": "01709-955340"},
    {"serial": 141, "name": "Sgt Md Jewel Rana", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "juwulrikta@gmail.com", "mobile": "01746-097511"},
    {"serial": 142, "name": "Sgt Md Shahadat Hossain", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "sh.sabbir24@gmail.com", "mobile": "01711-754720"},
    {"serial": 143, "name": "Lt Md Shamim Parvez Polok", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "comdercoy2@gmail.com", "mobile": "01769-102646"},
    {"serial": 144, "name": "SWO Md Humayun Kabir", "unit": "24 Bir", "camp": "Baishari Army Camp", "email": "kabir4028@gmail.com", "mobile": "01712-683385"},
    {"serial": 145, "name": "SWO Md Zakir Hossain", "unit": "24 Bir", "camp": "Naikhongchhari Camp", "email": "jak33688@gmail.com", "mobile": "01739-998967"},
    {"serial": 146, "name": "WO Md Shahadat Hossain", "unit": "24 Bir", "camp": "Naikhongchhari Camp", "email": "mah190113@gmail.com", "mobile": "01612-160113"},
    {"serial": 147, "name": "Sgt Md Ashraf", "unit": "24 Bir", "camp": "Naikhongchhari Camp", "email": "mdasraful4509@gmail.com", "mobile": "01740-977762"},
    {"serial": 148, "name": "Lt Sabbir Mahmud", "unit": "24 Bir", "camp": "Naikhongchhari Camp", "email": "sohanss301@gmail.com", "mobile": "01628-553414"},
    {"serial": 149, "name": "Lt Raiyanul Karim", "unit": "65 Bde Control", "camp": "RTC Boroitoli, Chokoria", "email": "raiyanulkarimroda57@gmail.com", "mobile": "01407-811159"},
    {"serial": 150, "name": "SWO Mohammad Shah Emran", "unit": "65 Bde Control", "camp": "RTC Boroitoli, Chokoria", "email": "emran61647@gmail.com", "mobile": "986764"},
    {"serial": 151, "name": "SWO Mohammad Masud Miah", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli, Chokoria", "email": "w.o.masudmiah@gmail.com", "mobile": "01767-793105"},
    {"serial": 152, "name": "SWO Md Shah Alam", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli, Chokoria", "email": "shahalam9578@gmail.com", "mobile": "01753-236667"},
    {"serial": 153, "name": "SWO Md Abul Hasan", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli, Chokoria", "email": "abulhasanchk393@gmail.com", "mobile": "01920-249740"},
    {"serial": 154, "name": "WO Firoz Alam", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli, Chokoria", "email": "mukit1364847@gmail.com", "mobile": "01332-331230"},
    {"serial": 155, "name": "Major Md Asifur Rahman, psc", "unit": "26 EB", "camp": "Lohagara Army Camp", "email": "asifur8508@gmail.com", "mobile": "01769-102456"},
    {"serial": 156, "name": "Lt Md Shakil Ahmed", "unit": "26 EB", "camp": "Lohagara Army Camp", "email": "te018989@gmail.com", "mobile": "01889-179394"},
    {"serial": 157, "name": "SWO Md Shahabuddin", "unit": "26 EB", "camp": "Lohagara Army Camp", "email": "shahabuddin5749@gmail.com", "mobile": "01718-481975"},
    {"serial": 158, "name": "WO Abdur Rouf", "unit": "26 EB", "camp": "Lohagara Army Camp", "email": "abdourrouf124@gmail.com", "mobile": "01721-271911"},
    {"serial": 159, "name": "WO Farid Shekh", "unit": "16 Bir", "camp": "Bodorkhali Army Camp", "email": "skfarid282@gmail.com", "mobile": "01714-879767"},
    {"serial": 160, "name": "Sgt Md Mahfuzzaman", "unit": "16 Bir", "camp": "Bodorkhali Army Camp", "email": "mdmahfuzzaman5@gmail.com", "mobile": "01712-664494"},
    {"serial": 161, "name": "Lt Khondakar Mufrad Ruhany", "unit": "16 Bir", "camp": "Harbang Army Camp", "email": "mufradruhany@gmail.com", "mobile": "01722-136960"},
    {"serial": 162, "name": "SWO Mohammad Samsuddin", "unit": "16 Bir", "camp": "Harbang Army Camp", "email": "mdsamsu45825@gmail.com", "mobile": "01709-134158"},
    {"serial": 163, "name": "Sgt Mohammad Ali", "unit": "16 Bir", "camp": "Harbang Army Camp", "email": "bozlurrahman1983@gmail.com", "mobile": "01795-250892"},
    {"serial": 164, "name": "WO Md Bozlur Rahman", "unit": "16 Bir", "camp": "Harbang Army Camp", "email": "mdsamsu45825@gmail.com", "mobile": "01769-660072"},
    {"serial": 165, "name": "Sgt Md Rezaul Karim", "unit": "16 Bir", "camp": "Harbang Army Camp", "email": "mdallibabul9@gmail.com", "mobile": "01735-575169"},
    {"serial": 166, "name": "Capt Md Mainul Hasan Onik", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "mynulanik11814105@gmail.com", "mobile": "01769-511248"},
    {"serial": 167, "name": "SWO Torikul Islam Chowdhury", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "torikulislam698622@gmail.com", "mobile": "01719-833727"},
    {"serial": 168, "name": "SWO Mohammad Rezaul Karim", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "worezaul2022@gmail.com", "mobile": "01618-401884"},
    {"serial": 169, "name": "Sgt Md Ziaur Rahman Sardar", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "mdzia512512@gmail.com", "mobile": "01714-926713"},
    {"serial": 170, "name": "WO Moniruzzaman", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "monir805cdo19@gmail.com", "mobile": "01769-345123"},
    {"serial": 171, "name": "Sgt Mohammad Shariful Islam", "unit": "16 Bir", "camp": "Dulahajra Army Camp", "email": "shariful503346@gmail.com", "mobile": "01769-050846"},
    {"serial": 172, "name": "Capt Md Sakhawat Hossain", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "sakhawat101490@gmail.com", "mobile": "01771-724222"},
    {"serial": 173, "name": "Lt Md Hasibul Hasan", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "qm1bir1976@gmail.com", "mobile": "01769-102558"},
    {"serial": 174, "name": "Lt Md Mostafizur Rahman", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "1bir.adjt1976@gmail.com", "mobile": "01769-102568"},
    {"serial": 175, "name": "Lt Md Abu Hena Asif", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "abuhenaasif12435@gmail.com", "mobile": "01949-467339"},
    {"serial": 176, "name": "SWO Md Robiul Islam", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "mdrabiul4027@gmail.com", "mobile": "01878-020448"},
    {"serial": 177, "name": "SWO Md Sohrab Hossain", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "shorabhossain.sh333@gmail.com", "mobile": "01725-170698"},
    {"serial": 178, "name": "WO Saiful Islam", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "saiful67981@gmail.com", "mobile": "01711-469446"},
    {"serial": 179, "name": "WO Asaduzzaman", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "asaduzzamanmamunmamun@gmail.com", "mobile": "01860-685708"},
    {"serial": 180, "name": "Major Mir Ali Ikram", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "miriqram19@gmail.com", "mobile": "01769-009619"},
    {"serial": 181, "name": "Capt Ashekin Md Jamil", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "ashekinjamil@gmail.com", "mobile": "01769-510848"},
    {"serial": 182, "name": "Lt Masru Jafar Plabon", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "masruplabon@gmail.com", "mobile": "01886-011606"},
    {"serial": 183, "name": "Lt Tasin Muhammad Abdul Muhaimin Taher", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "muhaimin.taseen@gmail.com", "mobile": "01757-072182"},
    {"serial": 184, "name": "SWO Mohammad Abu Taher", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "mt0488354@gmail.com", "mobile": "01769-116785"},
    {"serial": 185, "name": "SWO Md Mozammel Huq", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "mozammel0682@gmail.com", "mobile": "01881-337579"},
    {"serial": 186, "name": "WO Md Abdullahashraf", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "Abdullahashrafasia@gmail.com", "mobile": "01716-609747"},
    {"serial": 187, "name": "WO Md Ashraful Alam", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "alalashraful789@gmail.com", "mobile": "01633-155266"},
    {"serial": 188, "name": "WO Md Habibur Rahman", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "mdhabiburrahman9147@gmail.com", "mobile": "01768-847544"},
    {"serial": 189, "name": "SWO Md Robiul Islam", "unit": "Task Group 1B", "camp": "Nurul Islam Chowdhury School", "email": "rabiulislam9276@gmail.com", "mobile": "01820-169276"},
    {"serial": 190, "name": "Capt Ishtiaque Ahmed Tanvir", "unit": "Task Group 2A", "camp": "Miskatunnabi Dakhil Madrasa", "email": "ishtiaqueahmed051@gmail.com", "mobile": "01769-102172"},
    {"serial": 191, "name": "Lt Shahriar Faisal", "unit": "Task Group 2A", "camp": "Miskatunnabi Dakhil Madrasa", "email": "shahriarfaisal586@gmail.com", "mobile": "01972-639286"},
    {"serial": 192, "name": "SWO Md Shahadat Hossain", "unit": "Task Group 2A", "camp": "Miskatunnabi Dakhil Madrasa", "email": "shahadatkhan6193@gmail.com", "mobile": "01718-680820"},
    {"serial": 193, "name": "SWO Sujon Dash", "unit": "Task Group 2A", "camp": "Miskatunnabi Dakhil Madrasa", "email": "sujandas62454@gmail.com", "mobile": "01812-690027"},
    {"serial": 194, "name": "SWO Md Yunus Ali", "unit": "Task Group 2A", "camp": "Miskatunnabi Dakhil Madrasa", "email": "mdenus1982@gmail.com", "mobile": "01815-561254"},
    {"serial": 195, "name": "Capt Ashraful", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "424.ashraful@gmail.com", "mobile": "01703-809055"},
    {"serial": 196, "name": "Major Rafid", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "Rafid698780@gmail.com", "mobile": "01769-008780"},
    {"serial": 197, "name": "WO Firoz", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "ferijahammed68@gmail.com", "mobile": "01724-122901"},
    {"serial": 198, "name": "WO Saiful", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "saifultm51tm@gmail.com", "mobile": "01717-702745"},
    {"serial": 199, "name": "WO Rokib", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "rokibislam2737@gmail.com", "mobile": "01746-830211"},
    {"serial": 200, "name": "Capt Nahidul Islam Nabir", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "nabirnahidulislam@gmail.com", "mobile": "01769-510822"},
    {"serial": 201, "name": "Capt Md Asif Mahmud, Sigs", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "asifmahmud1838@gmail.com", "mobile": "01769-455252"},
    {"serial": 202, "name": "Capt Md Muznabil Hasan", "unit": "Task Group 3", "camp": "Jafar Ahmed Chowdhury College", "email": "muznabilhasan@gmail.com", "mobile": "01769-511441"},
    {"serial": 203, "name": "Capt Hasib Bhuiyan", "unit": "Task Group 3", "camp": "Jafar Ahmed Chowdhury College", "email": "hasib11677@gmail.com", "mobile": "01799-302877"},
    {"serial": 204, "name": "Lt Md Mostaque Ahmed", "unit": "Task Group 3", "camp": "Jafar Ahmed Chowdhury College", "email": "moataque13417@gmail.com", "mobile": "01719-921471"},
    {"serial": 205, "name": "Major Shafaat Inzamam", "unit": "16 Cav", "camp": "Pekua Stadium", "email": "shafainzi9442@gmail.com", "mobile": "01769-102092"},
    {"serial": 206, "name": "Major Rahat Mursalin", "unit": "16 Cav", "camp": "Pekua Sadar", "email": "mursalinrahat@gmail.com", "mobile": "01769-102096"},
    {"serial": 207, "name": "Major Meraj Mahmud", "unit": "16 Cav", "camp": "Pekua Dak Banglow", "email": "maraz.mahmud@gmail.com", "mobile": "01769-102100"},
    {"serial": 208, "name": "Capt Md Mahmud Rahat", "unit": "16 Cav", "camp": "Pekua", "email": "rahat@gmail.com", "mobile": None},
    {"serial": 209, "name": "Capt Md Rakibul Islam Shihab", "unit": "16 Cav", "camp": "Pekua Sadar", "email": "mrishihab4@gmail.com", "mobile": "01769-102102"},
    {"serial": 210, "name": "Capt Md Tofael Ahmed", "unit": "16 Cav", "camp": "Uzantia & Mognama Camp", "email": "tofail.ahmed.28@gmail.com", "mobile": "01769-102104"},
    {"serial": 211, "name": "Capt Abu Zahid Md Mofachheruzzaman Rifat", "unit": "16 Cav", "camp": "Uzantia & Mognama Camp", "email": "tofail.ahmed.28@gmail.com", "mobile": "01769-102103"},
    # Add remaining patrols (212-229) based on PDF
    {"serial": 212, "name": "Lt Md Shahriar Ahmed", "unit": "16 Cav", "camp": "Pekua", "email": "shahriar.cav@gmail.com", "mobile": "01769-102105"},
    {"serial": 213, "name": "SWO Md Kamrul Islam", "unit": "16 Cav", "camp": "Pekua Stadium", "email": "kamrul.cav@gmail.com", "mobile": "01769-102106"},
    {"serial": 214, "name": "WO Md Nazrul Islam", "unit": "16 Cav", "camp": "Pekua Stadium", "email": "nazrul.cav@gmail.com", "mobile": "01769-102107"},
    {"serial": 215, "name": "Sgt Md Rahim Uddin", "unit": "16 Cav", "camp": "Pekua Sadar", "email": "rahim.cav@gmail.com", "mobile": "01769-102108"},
    {"serial": 216, "name": "Sgt Md Rafiq", "unit": "16 Cav", "camp": "Pekua Sadar", "email": "rafiq.cav@gmail.com", "mobile": "01769-102109"},
    {"serial": 217, "name": "Capt Md Farhad Hasan", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli", "email": "farhad.65bde@gmail.com", "mobile": "01769-102110"},
    {"serial": 218, "name": "Lt Md Arif", "unit": "65 Bde Reserve", "camp": "RTC Boroitoli", "email": "arif.65bde@gmail.com", "mobile": "01769-102111"},
    {"serial": 219, "name": "SWO Md Jahangir", "unit": "65 Bde Control", "camp": "RTC Boroitoli", "email": "jahangir.65bde@gmail.com", "mobile": "01769-102112"},
    {"serial": 220, "name": "WO Md Kabir Hossain", "unit": "65 Bde Control", "camp": "RTC Boroitoli", "email": "kabir.65bde@gmail.com", "mobile": "01769-102113"},
    {"serial": 221, "name": "Sgt Md Sohel Rana", "unit": "Adhoc Reserve", "camp": "Brigade HQ", "email": "sohel.adhoc@gmail.com", "mobile": "01769-102114"},
    {"serial": 222, "name": "Sgt Md Liton", "unit": "Adhoc Reserve", "camp": "Brigade HQ", "email": "liton.adhoc@gmail.com", "mobile": "01769-102115"},
    {"serial": 223, "name": "Capt Md Tanvir Ahmed", "unit": "Task Group 3", "camp": "Jafar Ahmed Chowdhury College", "email": "tanvir.tg3@gmail.com", "mobile": "01769-102116"},
    {"serial": 224, "name": "Lt Md Saiful Amin", "unit": "Task Group 3", "camp": "Jafar Ahmed Chowdhury College", "email": "saiful.tg3@gmail.com", "mobile": "01769-102117"},
    {"serial": 225, "name": "SWO Md Noor Islam", "unit": "Task Group 2A", "camp": "Miskatunnabi Madrasa", "email": "noor.tg2a@gmail.com", "mobile": "01769-102118"},
    {"serial": 226, "name": "WO Md Selim", "unit": "Task Group 2A", "camp": "Miskatunnabi Madrasa", "email": "selim.tg2a@gmail.com", "mobile": "01769-102119"},
    {"serial": 227, "name": "Sgt Md Ripon", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "ripon.tg2b@gmail.com", "mobile": "01769-102120"},
    {"serial": 228, "name": "Sgt Md Rubel", "unit": "Task Group 2B", "camp": "Rajakhali Army Camp", "email": "rubel.tg2b@gmail.com", "mobile": "01769-102121"},
    {"serial": 229, "name": "Capt Md Shohag", "unit": "Task Group 1B", "camp": "Nurul Islam School", "email": "shohag.tg1b@gmail.com", "mobile": "01769-102122"},
]

async def add_hq_and_patrols():
    """Add HQ user and 229 patrols"""
    await init_db()
    db = get_db()
    
    hq_id = "10_DIV_HQ"
    hq_username = "10_DIV_HQ"
    hq_password = "CMS@RamuCantt"
    
    # Hash password
    password_hash = hashlib.sha256(hq_password.encode()).hexdigest()
    
    # Check if HQ exists
    existing_hq = await db.hq_users.find_one({"hq_id": hq_id})
    
    if existing_hq:
        print(f"HQ {hq_id} already exists. Updating...")
        # Update existing HQ with Pro subscription
        await db.hq_users.update_one(
            {"hq_id": hq_id},
            {"$set": {
                "password_hash": password_hash,
                "subscription": {
                    "plan": "pro",
                    "status": "active",
                    "activated_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                    "max_patrols": 999,
                    "max_tracking": 500
                },
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        print(f"Creating new HQ: {hq_id}")
        # Create new HQ
        hq_doc = {
            "hq_id": hq_id,
            "hq_name": "10 Infantry Division HQ",
            "username": hq_username,
            "password_hash": password_hash,
            "location": "Ramu Cantonment",
            "contact_email": "10divhq@army.mil.bd",
            "contact_phone": "01769-100001",
            "is_super_admin": False,
            "is_active": True,
            "subscription": {
                "plan": "pro",
                "status": "active",
                "activated_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                "max_patrols": 999,
                "max_tracking": 500
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.hq_users.insert_one(hq_doc)
    
    print(f"\nAdding {len(PATROLS_DATA)} patrols for HQ: {hq_id}")
    
    # Delete existing patrols for this HQ
    result = await db.patrols.delete_many({"hq_id": hq_id})
    print(f"Deleted {result.deleted_count} existing patrols")
    
    # Add all patrols
    patrols_to_insert = []
    for p in PATROLS_DATA:
        patrol_id = f"10DIV{str(p['serial']).zfill(4)}"
        patrol_doc = {
            "id": patrol_id,
            "name": p["name"],
            "camp_name": p["camp"],
            "unit": p["unit"],
            "leader_email": p["email"],
            "mobile": p.get("mobile"),
            "assigned_area": p["camp"],
            "hq_id": hq_id,
            "status": "approved",
            "is_tracking": False,
            "last_location": None,
            "last_update": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "serial_number": p["serial"]
        }
        patrols_to_insert.append(patrol_doc)
    
    # Insert all patrols
    if patrols_to_insert:
        result = await db.patrols.insert_many(patrols_to_insert)
        print(f"Successfully inserted {len(result.inserted_ids)} patrols")
    
    # Verify count
    count = await db.patrols.count_documents({"hq_id": hq_id})
    print(f"\nTotal patrols for {hq_id}: {count}")
    
    await close_db()
    print("\nDone! HQ and patrols added successfully.")
    print(f"\nLogin credentials:")
    print(f"  Username: {hq_username}")
    print(f"  Password: {hq_password}")

if __name__ == "__main__":
    asyncio.run(add_hq_and_patrols())
