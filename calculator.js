(function () {
  "use strict";

  var out = document.getElementById("out");
  var exprEl = document.getElementById("expr");
  var tapeEl = document.getElementById("tape");
  var tapeEmpty = document.getElementById("tape-empty");
  var pad = document.getElementById("pad");

  var current = "0";      // what the user is typing, as a string
  var stored = null;      // the left-hand number
  var pendingOp = null;   // "+", "−", "×", "÷"
  var awaitingNew = true; // next digit starts a fresh number
  var errored = false;

  var MAX_DIGITS = 12;

  function group(numStr) {
    var neg = numStr.charAt(0) === "-";
    if (neg) numStr = numStr.slice(1);
    var parts = numStr.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + parts.join(".");
  }

  function format(n) {
    if (!isFinite(n)) return "Error";
    var s;
    if (n !== 0 && (Math.abs(n) >= 1e12 || Math.abs(n) < 1e-9)) {
      s = n.toExponential(6).replace(/\.?0+e/, "e");
      return s;
    }
    s = String(parseFloat(n.toPrecision(MAX_DIGITS)));
    return group(s);
  }

  function render() {
    out.classList.toggle("error", errored);
    out.textContent = errored ? current : group(current);
    out.scrollLeft = out.scrollWidth;
    var e = "";
    if (stored !== null && pendingOp) e = format(stored) + " " + pendingOp;
    exprEl.innerHTML = e || "&nbsp;";
    var buttons = pad.querySelectorAll(".key.op");
    for (var i = 0; i < buttons.length; i++) {
      var active = !errored && pendingOp === buttons[i].dataset.op && awaitingNew;
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function fail(msg) {
    errored = true;
    current = msg;
    stored = null;
    pendingOp = null;
    awaitingNew = true;
    render();
  }

  function clearAll() {
    errored = false;
    current = "0";
    stored = null;
    pendingOp = null;
    awaitingNew = true;
    render();
  }

  function digitsIn(s) {
    return s.replace(/[-.]/g, "").length;
  }

  function inputDigit(d) {
    if (errored) clearAll();
    if (awaitingNew) {
      current = d;
      awaitingNew = false;
    } else {
      if (digitsIn(current) >= MAX_DIGITS) return;
      current = current === "0" ? d : current + d;
    }
    render();
  }

  function inputDot() {
    if (errored) clearAll();
    if (awaitingNew) {
      current = "0.";
      awaitingNew = false;
    } else if (current.indexOf(".") === -1) {
      current += ".";
    }
    render();
  }

  function backspace() {
    if (errored) { clearAll(); return; }
    if (awaitingNew) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    if (current === "-" || current === "") current = "0";
    if (current === "0") awaitingNew = true;
    render();
  }

  function toggleSign() {
    if (errored) return;
    current = current.charAt(0) === "-" ? current.slice(1) : "-" + current;
    if (current === "-0") current = "0";
    render();
  }

  function percent() {
    if (errored) return;
    var n = parseFloat(current) / 100;
    current = String(n);
    awaitingNew = false;
    render();
  }

  function compute(a, op, b) {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? null : a / b;
    }
    return b;
  }

  function chooseOp(op) {
    if (errored) return;
    var value = parseFloat(current);
    if (stored !== null && pendingOp && !awaitingNew) {
      var r = compute(stored, pendingOp, value);
      if (r === null) { fail("Can't divide by 0"); return; }
      stored = r;
      current = String(parseFloat(r.toPrecision(MAX_DIGITS)));
    } else {
      stored = value;
    }
    pendingOp = op;
    awaitingNew = true;
    render();
  }

  function equals() {
    if (errored) return;
    if (stored === null || !pendingOp) return;
    var a = stored, b = parseFloat(current), op = pendingOp;
    var r = compute(a, op, b);
    if (r === null) { fail("Can't divide by 0"); return; }
    addTape(format(a) + " " + op + " " + format(b), format(r));
    current = String(parseFloat(r.toPrecision(MAX_DIGITS)));
    stored = null;
    pendingOp = null;
    awaitingNew = true;
    render();
  }

  function addTape(expression, result) {
    tapeEmpty.hidden = true;
    var li = document.createElement("li");
    var left = document.createElement("span");
    left.textContent = expression;
    var right = document.createElement("span");
    right.textContent = "= " + result;
    li.appendChild(left);
    li.appendChild(right);
    tapeEl.insertBefore(li, tapeEl.firstChild);
    while (tapeEl.children.length > 6) {
      tapeEl.removeChild(tapeEl.lastChild);
    }
  }

  pad.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".key");
    if (!btn) return;
    if (btn.dataset.digit) return inputDigit(btn.dataset.digit);
    if (btn.dataset.op) return chooseOp(btn.dataset.op);
    switch (btn.dataset.action) {
      case "clear": return clearAll();
      case "back": return backspace();
      case "percent": return percent();
      case "sign": return toggleSign();
      case "dot": return inputDot();
      case "equals": return equals();
    }
  });

  function flash(selector) {
    var btn = pad.querySelector(selector);
    if (!btn) return;
    btn.classList.add("pressed");
    setTimeout(function () { btn.classList.remove("pressed"); }, 90);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var k = ev.key;
    if (k >= "0" && k <= "9") {
      inputDigit(k); flash('[data-digit="' + k + '"]');
    } else if (k === "." || k === ",") {
      inputDot(); flash('[data-action="dot"]');
    } else if (k === "+" || k === "-") {
      var op = k === "+" ? "+" : "−";
      chooseOp(op); flash('[data-op="' + op + '"]');
    } else if (k === "*" || k === "x" || k === "X") {
      chooseOp("×"); flash('[data-op="×"]');
    } else if (k === "/") {
      ev.preventDefault(); chooseOp("÷"); flash('[data-op="÷"]');
    } else if (k === "Enter" || k === "=") {
      if (document.activeElement && document.activeElement.classList.contains("key")) return;
      ev.preventDefault(); equals(); flash('[data-action="equals"]');
    } else if (k === "Backspace") {
      ev.preventDefault(); backspace(); flash('[data-action="back"]');
    } else if (k === "Escape" || k === "Delete") {
      clearAll(); flash('[data-action="clear"]');
    } else if (k === "%") {
      percent(); flash('[data-action="percent"]');
    }
  });

  render();
})();