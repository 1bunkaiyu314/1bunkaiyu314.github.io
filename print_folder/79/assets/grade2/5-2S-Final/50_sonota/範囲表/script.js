fetch("test-data.json")
  .then(res => res.json())
  .then(data => {
    renderDateTabs(data.tests);
  });

function renderDateTabs(tests) {
  const tabArea = document.getElementById("date-tabs");

  tests.forEach((test, index) => {
    const btn = document.createElement("button");
    btn.className = "date-btn";
    btn.textContent = test.date;
    btn.style.background = dateColors[test.date] || "#555";

    btn.onclick = () => {
      document.querySelectorAll(".date-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSubjects(test);
    };

    if (index === 0) {
      btn.classList.add("active");
      renderSubjects(test);
    }

    tabArea.appendChild(btn);
  });
}

function renderSubjects(test) {
  const area = document.getElementById("subjects");
  area.innerHTML = "";

  test.subject.forEach(sub => {
    const btn = document.createElement("button");
    btn.className = "subject-btn";
    btn.textContent = `${sub.period}限 ${sub.name}（${sub.time[0]}-${sub.time[1]}）`;
    btn.style.background = subjectColors[sub.name] || "#4da3ff";

    btn.onclick = () => {
      document.querySelectorAll(".subject-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showDetail(sub);
    };

    area.appendChild(btn);
  });

  const firstBtn = area.querySelector(".subject-btn");
  firstBtn?.click();
}

function showDetail(sub) {
  const detail = document.getElementById("detail");

  const newHTML = `
    <div class="detail-inner">
      ${sub.exam_range ? `<div class="block"><strong>出題範囲</strong>${sub.exam_range}</div>` : ""}
      ${sub.exam_range && sub.hw_range ? `<div style="height:16px;"></div>` : ""}
      ${sub.hw_range ? `<div class="block"><strong>課題範囲</strong>${sub.hw_range}</div>` : ""}
    </div>
  `;

  const startHeight = detail.offsetHeight;
  detail.innerHTML = newHTML;
  const endHeight = detail.scrollHeight;

  detail.style.height = startHeight + "px";
  detail.offsetHeight;

  requestAnimationFrame(() => {
    detail.style.height = endHeight + "px";
  });

  detail.addEventListener("transitionend", function handler() {
    detail.style.height = "auto";
    detail.removeEventListener("transitionend", handler);
  });
}

const dateColors = {
  "2/19": "#7AA9C9",
  "2/20": "#C9D2DB",
  "2/24": "#DCCFB5",
  "2/25": "#9BBCA0",
  "2/26": "#D9A9BB"
};

const subjectColors = {
  "英語D": "#E7B7C8",
  "英語長文": "#E7B7C8",
  "英語R": "#E7B7C8",

  "現代文": "#E38A8A",
  "古典": "#E38A8A",

  "日本史探究": "#E8DCC2",
  "地理探究": "#E8DCC2",
  "世界史探究": "#E8DCC2",
  "公共": "#E8DCC2",

  "数学β S": "#BFD7ED",
  "数学β L": "#BFD7ED",
  "数学特講": "#BFD7ED",
  "数学α": "#BFD7ED",

  "物理特講": "#CFE3D4",
  "生物特講": "#CFE3D4",
  "化学特講": "#CFE3D4",
  "地学特講": "#CFE3D4"
};
