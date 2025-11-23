const examMap = {
  "1": "1-1S-Mid1",   // 前期第一中間考査
  "2": "2-1S-Mid2",   // 前期第二中間考査
  "3": "3-1S-Final",  // 前期期末考査
  "4": "4-2S-Mid",    // 後期中間考査
  "5": "5-2S-Final"   // 学年末考査
};

const subjectsByGrade = {
  "1": [
    { value: "1", text: "現代文" },
    { value: "3", text: "古典" },
    { value: "6", text: "地理総合" },
    { value: "9", text: "歴史総合" },
    { value: "17", text: "理数数学Iα" },
    { value: "19", text: "理数数学Iβ" },
    { value: "26", text: "理数化学" },
    { value: "29", text: "理数物理" },
    { value: "38", text: "総合英語IR" },
    { value: "41", text: "英語DI" },
    { value: "46", text: "家庭基礎" },
    { value: "47", text: "保険" }
  ],

  "2": [
    { value: "1", text: "現代文" },
    { value: "3", text: "古典" },
    { value: "7", text: "地理探究" },
    { value: "10", text: "日本史探究" },
    { value: "12", text: "世界史探求" },
    { value: "14", text: "公共" },
    { value: "18", text: "理数数学IIα" },
    { value: "20", text: "理数数学IIβS" },
    { value: "22", text: "理数数学IIβL" },
    { value: "24", text: "数学特講" },
    { value: "27", text: "化学特講" },
    { value: "30", text: "物理特講" },
    { value: "33", text: "生物特講" },
    { value: "35", text: "地学特講" },
    { value: "39", text: "総合英語IIR" },
    { value: "42", text: "英語DII" },
    { value: "43", text: "総合英語II長文" },
    { value: "47", text: "保険" },
    { value: "48", text: "IBARAMA III" },
    { value: "50", text: "その他" }
  ],

  "3": [
    { value: "1", text: "現代文" },
    { value: "2", text: "現代世界を読む" },
    { value: "4", text: "古典探求" },
    { value: "5", text: "古典講読" },
    { value: "7", text: "地理探究" },
    { value: "8", text: "地理講究" },
    { value: "10", text: "日本史探究" },
    { value: "11", text: "日本史特講" },
    { value: "12", text: "世界史探求" },
    { value: "13", text: "世界史特講" },
    { value: "15", text: "倫政特講" },
    { value: "16", text: "倫政講究" },
    { value: "21", text: "理数数学IIS" },
    { value: "23", text: "理数数学IIL" },
    { value: "24", text: "数学特講" },
    { value: "25", text: "数学講究S" },
    { value: "28", text: "化学講究S" },
    { value: "31", text: "物理講究S" },
    { value: "34", text: "生物講究S" },
    { value: "36", text: "物L化L生L地L" },
    { value: "37", text: "理科演習L" },
    { value: "40", text: "総合英語IIIR" },
    { value: "44", text: "総合英語III長文" },
    { value: "45", text: "英語W" },
    { value: "49", text: "IBARAMA IV" },
    { value: "50", text: "その他" }
  ]
};



const subjectMap = {
  "1":  "01_genbun",          // 現代文
  "2":  "02_genbun-yomu",     // 現代世界を読む
  "3":  "03_koten",           // 古典
  "4":  "04_koten-tankyu",    // 古典探求
  "5":  "05_koten-koudoku",   // 古典講読
  "6":  "06_tiri-sougou",     // 地理総合
  "7":  "07_tiri-tankyu",     // 地理探究
  "8":  "08_tiri-koukyu",     // 地理講究
  "9":  "09_rekishi-sougou",  // 歴史総合
  "10": "10_nihonshi-tankyu", // 日本史探究
  "11": "11_nihonshi-tokkou", // 日本史特講
  "12": "12_sekaishi-tankyu", // 世界史探求
  "13": "13_sekaishi-tokkou", // 世界史特講
  "14": "14_koukyou",         // 公共
  "15": "15_rinsei-tokkou",   // 倫政特講
  "16": "16_rinsei-koukyu",   // 倫政講究
  "17": "17_mathIa",          // 理数数学Iα
  "18": "18_mathIIa",         // 理数数学IIα
  "19": "19_mathIb",          // 理数数学Iβ
  "20": "20_mathIIbS",        // 理数数学IIβS
  "21": "21_mathIIS",         // 理数数学IIS
  "22": "22_mathIIbL",        // 理数数学IIβL
  "23": "23_mathIIL",         // 理数数学IIL
  "24": "24_math-tokkou",     // 数学特講
  "25": "25_math-koukyuS",    // 数学講究S
  "26": "26_kagaku",          // 理数化学
  "27": "27_kagaku-tokkou",   // 化学特講
  "28": "28_kagaku-koukyuS",  // 化学講究S
  "29": "29_buturi",          // 理数物理
  "30": "30_buturi-tokkou",   // 物理特講
  "31": "31_buturi-koukyuS",  // 物理講究S
  "32": "32_seibutu",         // 理数生物
  "33": "33_seibutu-tokkou",  // 生物特講
  "34": "34_seibutu-koukyuS", // 生物講究S
  "35": "35_tigaku-tokkou",   // 地学特講
  "36": "36_scienceL",        // 物L化L生L地L
  "37": "37_scienceL-ensyu",  // 理科演習L
  "38": "38_eigo-IR",         // 総合英語IR
  "39": "39_eigo-IIR",        // 総合英語IIR
  "40": "40_eigo-IIIR",       // 総合英語IIIR
  "41": "41_eigo-DI",         // 英語DI
  "42": "42_eigo-DII",        // 英語DII
  "43": "43_eigo-II-tyobun",  // 総合英語II長文
  "44": "44_eigo-III-tyobun", // 総合英語III長文
  "45": "45_eigo-W",          // 英語W
  "46": "46_kateikiso",       // 家庭基礎
  "47": "47_hoken",           // 保険
  "48": "48_IBA-III",         // IBARAMA III
  "49": "49_IBA-IV",          // IBARAMA IV
  "50": "50_sonota"           // その他
};

function updateSubjects() {
  const grade = document.getElementById('grade').value;
  const subjectSelect = document.getElementById('subject');
  subjectSelect.innerHTML = "";

  subjectsByGrade[grade].forEach(subj => {
    const opt = document.createElement('option');
    opt.value = subj.value;
    opt.textContent = subj.text;
    subjectSelect.appendChild(opt);
  });
}

function updateDir() {
  const term = document.getElementById('term').value;
  const grade = document.getElementById('grade').value;
  const exam = document.getElementById('exam').value;
  const subject = document.getElementById('subject').value;
  const other = document.getElementById('other-subject').value;

  const examDir = examMap[exam] || "unknown-exam";
  const subjectDir = subjectMap[subject] || (other ? other : "unknown-subject");

  const path = `https://github.com/1bunkaiyu314/1bunkaiyu314.github.io/tree/main/print_folder/${term}/assets/grade${grade}/${examDir}/${subjectDir}/`;

  document.getElementById('suggest-dir').innerHTML =
    `<a href="${path}" target="_blank">${path}</a>`;
}

// イベント設定
document.getElementById('grade').addEventListener('change', () => {
  updateSubjects();
  updateDir();
});
document.getElementById('exam').addEventListener('change', updateDir);
document.getElementById('subject').addEventListener('change', updateDir);
document.getElementById('term').addEventListener('change', updateDir);
document.getElementById('other-subject').addEventListener('input', updateDir);

// 初期化
updateSubjects();
updateDir();