const JSON_PATH = 'exams.json';

async function loadAndRenderAll(jsonPath = JSON_PATH) {
  try {
    const res = await fetch(jsonPath, { cache: 'no-store' });
    if (!res.ok) throw new Error('failed to load JSON: ' + res.status);
    const grades = await res.json();
    renderGradeTabs(grades);
    if (grades && grades.length) {
      selectGrade(1, grades);
    }
  } catch (err) {
    console.error(err);
    document.getElementById('exams-container').innerHTML =
      '<p style="color:crimson">資料の読み込みに失敗しました。</p>';
  }
}

function renderGradeTabs(grades) {
  const tabs = document.getElementById('grade-tabs');
  tabs.innerHTML = '';
  grades.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.textContent = g.title || `Grade ${g.grade}`;
    btn.dataset.index = i;
    btn.addEventListener('click', () => selectGrade(i, grades));
    tabs.appendChild(btn);
  });
}

function selectGrade(index, grades) {
  const tabs = document.getElementById('grade-tabs').children;
  Array.from(tabs).forEach((b, i) => b.classList.toggle('active', i === index));
  renderExamsForGrade(grades[index]);
}

function renderExamsForGrade(gradeObj) {
  const container = document.getElementById('exams-container');
  container.innerHTML = '';
  const examTpl = document.getElementById('exam-template');
  const subjectTpl = document.getElementById('subject-template');

  (gradeObj.exams || []).forEach(exam => {
    const validSubjects = (exam.subjects || []).filter(subject => subject.links && subject.links.length > 0);

    if (validSubjects.length === 0) return;

    const examClone = examTpl.content.cloneNode(true);
    const examBlock = examClone.querySelector('.exam-block');
    const examBtn = examBlock.querySelector('.exam-toggle');
    const subjectList = examBlock.querySelector('.subject-list');

    examBtn.textContent = exam.title;

    validSubjects.forEach(subject => {
      const subjectClone = subjectTpl.content.cloneNode(true);
      const subjectBlock = subjectClone.querySelector('.subject-block');
      const subjectBtn = subjectBlock.querySelector('.subject-toggle');
      const pdfList = subjectBlock.querySelector('.pdf-list');

      subjectBtn.textContent = subject.name;

      subject.links.forEach(link => {
        const a = document.createElement('a');
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener';
        // label が無ければファイル名を自動利用
        a.textContent = link.label || link.href.split('/').pop();
        pdfList.appendChild(a);
      });


      subjectList.appendChild(subjectBlock);
    });

    container.appendChild(examBlock);
  });

  setupAccordion('.exam-toggle');
  setupAccordion('.subject-toggle');
}

function setupAccordion(buttonSelector) {
  document.querySelectorAll(buttonSelector).forEach(button => {
    const content = button.nextElementSibling;
    if (!content) return;

    button.dataset.open = 'false';
    button.setAttribute('aria-expanded', 'false');
    content.style.overflow = 'hidden';
    content.style.maxHeight = '0';
    content.style.transition = content.style.transition || 'max-height 320ms ease';

    content.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'max-height') return;
      if (button.dataset.open === 'true') {
        content.style.maxHeight = 'none';
      }
    });

    button.addEventListener('click', () => {
      const isOpen = button.dataset.open === 'true';

      if (isOpen) {
        if (content.style.maxHeight === 'none') {
          const h = content.scrollHeight;
          content.style.maxHeight = h + 'px';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              content.style.maxHeight = '0';
            });
          });
        } else {
          content.style.maxHeight = '0';
        }
        button.dataset.open = 'false';
        button.setAttribute('aria-expanded', 'false');
      } else {
        if (content.style.maxHeight === 'none') content.style.maxHeight = '0';
        requestAnimationFrame(() => {
          const targetH = content.scrollHeight;
          content.style.maxHeight = targetH + 'px';
        });
        button.dataset.open = 'true';
        button.setAttribute('aria-expanded', 'true');
      }
    });

    window.addEventListener('resize', () => {
      if (button.dataset.open === 'true') {
        const prev = content.style.transition;
        content.style.transition = 'none';
        content.style.maxHeight = content.scrollHeight + 'px';
        requestAnimationFrame(() => {
          content.style.transition = prev;
        });
      }
    });
  });
}

document.getElementById('year').textContent = new Date().getFullYear();

const toggleBtn = document.getElementById('dark-mode-toggle');

// 初期状態: OS/ブラウザの設定に従う
window.addEventListener('DOMContentLoaded', () => {
  let theme = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.dataset.theme = theme;
  toggleBtn.textContent = theme === 'dark' ? '☀' : '🌙';
});

// ボタンで切り替え
toggleBtn.addEventListener('click', () => {
  const current = document.body.dataset.theme;
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = newTheme;
  localStorage.setItem('theme', newTheme);
  toggleBtn.textContent = newTheme === 'dark' ? '☀' : '🌙';
});

loadAndRenderAll();