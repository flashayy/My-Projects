const participants = [
  "Matúš Kováč",
  "Jana Novotná",
  "Peter Horváth",
  "Lucia Blahová",
  "Tomáš Varga",
  "Zuzana Klement",
  "Martin Oravec",
  "Kristína Fialová",
  "Jakub Hudák",
  "Monika Šimková",
  "Rastislav Baláž",
  "Andrea Bieliková",
  "Miroslav Tóth",
  "Eva Polák",
  "Ondrej Hric",
  "Veronika Kováčová",
  "Filip Černý",
  "Simona Vojteková",
  "Lukáš Krajčovič",
  "Petra Malá",
  "Marek Dvořák",
  "Ivana Kováčová",
  "Martin Novák",
  "Zuzana Horváthová",
  "Tomáš Klement",
  "Jana Oravská",
  "Peter Fiala",
    "Lucia Hudáková",
    "Rastislav Šimko",
    "Andrea Balážová",
    "Miroslav Krajčovič",
    "Eva Malá",
    "Ondrej Dvořák",
    "Veronika Tóthová",
    "Filip Kováč",
    "Simona Novotná",
    "Lukáš Horváth",
];

let isRolling = false;

function getRandomWinner(names) {
  const index = Math.floor(Math.random() * names.length);
  return names[index];
}

function shuffleNames(names) {
  const arr = [...names];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rollAnimation(slotEl, winner) {
  const totalItems = 30;
  const allNames = shuffleNames([
    ...participants,
    ...participants,
    ...participants,
  ]).slice(0, totalItems - 1);
  allNames.push(winner);

  slotEl.innerHTML = "";

  for (const name of allNames) {
    const div = document.createElement("div");
    div.className = "slot-item";
    div.textContent = name;
    slotEl.appendChild(div);
  }

  const itemHeight = 72;
  const visibleCenter = 2;
  const targetIndex = allNames.length - 1;
  const targetScroll = (targetIndex - visibleCenter) * itemHeight;

  slotEl.style.transition = "none";
  slotEl.style.transform = "translateY(0)";

  await sleep(50);

  const duration = 3800;
  const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

  slotEl.style.transition = `transform ${duration}ms ${easing}`;
  slotEl.style.transform = `translateY(-${targetScroll}px)`;
}

async function selectWinner() {
  if (isRolling) return;
  isRolling = true;

  const btn = document.getElementById("roll-btn");
  const slotEl = document.getElementById("slot-items");
  const resultEl = document.getElementById("result-name");
  const resultBox = document.getElementById("result-box");
  const overlay = document.getElementById("winner-overlay");

  btn.disabled = true;
  btn.classList.add("rolling");
  resultBox.classList.remove("visible");
  overlay.classList.remove("visible");

  const winner = getRandomWinner(participants);

  await rollAnimation(slotEl, winner);
  await sleep(4000);

  const items = slotEl.querySelectorAll(".slot-item");
  const lastItem = items[items.length - 1];
  lastItem.classList.add("winner-highlight");

  await sleep(600);

  resultEl.textContent = winner;
  resultBox.classList.add("visible");
  overlay.classList.add("visible");

  btn.disabled = false;
  btn.classList.remove("rolling");
  btn.textContent = "🎲 Vybrať znova";
  isRolling = false;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("roll-btn").addEventListener("click", selectWinner);

  document.getElementById("winner-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.remove("visible");
    }
  });
});