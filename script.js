(function () {
  "use strict";

  /* ---------------------------------------------------------
     1. Preenche a página com os dados de config.js
  --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);

  function formatarDataLegivel(dataISO) {
    const d = new Date(dataISO);
    return d.toLocaleString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function preencherConfig() {
    $("nivel-num").textContent = CONFIG.nivel;
    $("nome-aniversariante").textContent = CONFIG.aniversariante;
    $("subtitulo-evento").textContent = CONFIG.subtitulo;
    $("meta-data").textContent = "📅 " + formatarDataLegivel(CONFIG.dataEvento);
    $("meta-local").textContent = "📍 " + CONFIG.local.nome + " — " + CONFIG.local.endereco;
    $("footer-nome").textContent = CONFIG.aniversariante;
    $("footer-nivel").textContent = "LEVEL " + CONFIG.nivel;
    document.title = `LEVEL ${CONFIG.nivel} COMPLETE — ${CONFIG.aniversariante}`;

    const mapsLink = $("meta-maps");
    if (CONFIG.local.mapsUrl) {
      mapsLink.href = CONFIG.local.mapsUrl;
    } else {
      mapsLink.style.display = "none";
    }
  }

  /* ---------------------------------------------------------
     2. Contador regressivo
  --------------------------------------------------------- */
  function iniciarCountdown() {
    const alvo = new Date(CONFIG.dataEvento).getTime();

    function tick() {
      const agora = Date.now();
      const diff = alvo - agora;

      if (diff <= 0) {
        $("cd-days").textContent = "00";
        $("cd-hours").textContent = "00";
        $("cd-minutes").textContent = "00";
        $("cd-seconds").textContent = "00";
        $("hud-status").textContent = "EM ANDAMENTO";
        return;
      }

      const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
      const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutos = Math.floor((diff / (1000 * 60)) % 60);
      const segundos = Math.floor((diff / 1000) % 60);

      $("cd-days").textContent = String(dias).padStart(2, "0");
      $("cd-hours").textContent = String(horas).padStart(2, "0");
      $("cd-minutes").textContent = String(minutos).padStart(2, "0");
      $("cd-seconds").textContent = String(segundos).padStart(2, "0");
    }

    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------
     3. Formulário: nome, acompanhante, quantidade, tipo
  --------------------------------------------------------- */
  let temAcompanhante = false;
  let quantidade = 1;

  function renderCompanionRows() {
    const list = $("companion-list");
    list.innerHTML = "";
    for (let i = 1; i <= quantidade; i++) {
      const row = document.createElement("div");
      row.className = "companion-row";

      const label = document.createElement("span");
      label.className = "companion-row-label";
      label.textContent = `Acompanhante ${i}`;

      const select = document.createElement("select");
      select.name = `acompanhante-${i}-tipo`;
      select.dataset.index = String(i);
      select.innerHTML = `
        <option value="adulto">Adulto</option>
        <option value="crianca">Criança</option>
      `;

      row.appendChild(label);
      row.appendChild(select);
      list.appendChild(row);
    }
  }

  function initFormulario() {
    const btnSem = $("btn-sem-acompanhante");
    const btnCom = $("btn-com-acompanhante");
    const companionBlock = $("companion-block");
    const btnMenos = $("btn-menos");
    const btnMais = $("btn-mais");
    const qtdValue = $("qtd-value");
    const inputNome = $("input-nome");
    const form = $("rsvp-form");
    const formError = $("form-error");
    const submitBtn = $("submit-btn");

    inputNome.addEventListener("input", () => {
      $("hud-player").textContent = inputNome.value.trim() || "???";
    });

    btnSem.addEventListener("click", () => {
      temAcompanhante = false;
      btnSem.setAttribute("aria-pressed", "true");
      btnCom.setAttribute("aria-pressed", "false");
      companionBlock.hidden = true;
    });

    btnCom.addEventListener("click", () => {
      temAcompanhante = true;
      btnCom.setAttribute("aria-pressed", "true");
      btnSem.setAttribute("aria-pressed", "false");
      companionBlock.hidden = false;
      renderCompanionRows();
    });

    btnMenos.addEventListener("click", () => {
      if (quantidade > 1) {
        quantidade -= 1;
        qtdValue.textContent = String(quantidade);
        renderCompanionRows();
      }
      btnMais.disabled = quantidade >= CONFIG.maxAcompanhantes;
      btnMenos.disabled = quantidade <= 1;
    });

    btnMais.addEventListener("click", () => {
      if (quantidade < CONFIG.maxAcompanhantes) {
        quantidade += 1;
        qtdValue.textContent = String(quantidade);
        renderCompanionRows();
      }
      btnMais.disabled = quantidade >= CONFIG.maxAcompanhantes;
      btnMenos.disabled = quantidade <= 1;
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      formError.hidden = true;

      const nome = inputNome.value.trim();
      if (!nome) {
        formError.hidden = false;
        inputNome.focus();
        return;
      }

      const acompanhantes = [];
      if (temAcompanhante) {
        document.querySelectorAll("#companion-list select").forEach((sel) => {
          acompanhantes.push(sel.value); // "adulto" ou "crianca"
        });
      }

      const payload = {
        nome,
        temAcompanhante,
        quantidadeAcompanhantes: temAcompanhante ? quantidade : 0,
        acompanhantes, // ex: ["adulto", "crianca"]
        adultos: acompanhantes.filter((t) => t === "adulto").length,
        criancas: acompanhantes.filter((t) => t === "crianca").length,
        dataEnvio: new Date().toISOString()
      };

      submitBtn.disabled = true;
      submitBtn.querySelector("span").textContent = "ENVIANDO...";

      try {
        await enviarParaGoogleSheets(payload);
        $("hud-status").textContent = "CONFIRMADO";
        form.hidden = true;
        const successPanel = $("success-panel");
        successPanel.hidden = false;
        $("success-text").textContent = temAcompanhante
          ? `Presença confirmada para ${nome} + ${quantidade} acompanhante(s). Prepare o controle!`
          : `Presença confirmada para ${nome}. Prepare o controle!`;
      } catch (err) {
        formError.hidden = false;
        formError.textContent = "⚠ Não foi possível enviar agora. Tente novamente em instantes.";
        submitBtn.disabled = false;
        submitBtn.querySelector("span").textContent = "CONFIRMAR PRESENÇA";
        console.error("Erro ao enviar RSVP:", err);
      }
    });
  }

  /* ---------------------------------------------------------
     4. Envio para o Google Sheets (via Google Apps Script)
     Veja o README.md para instruções de configuração.
  --------------------------------------------------------- */
  async function enviarParaGoogleSheets(payload) {
    if (!CONFIG.googleSheetsWebAppUrl || CONFIG.googleSheetsWebAppUrl.includes("COLOQUE_AQUI")) {
      console.warn("googleSheetsWebAppUrl não configurada em config.js — envio simulado.");
      return Promise.resolve();
    }

    // Apps Script Web Apps normalmente não retornam headers CORS,
    // então usamos "no-cors": o envio funciona, mas não conseguimos
    // ler a resposta de volta (o fetch resolve mesmo sem erro real).
    await fetch(CONFIG.googleSheetsWebAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
  }

  /* ---------------------------------------------------------
     Inicialização
  --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    preencherConfig();
    iniciarCountdown();
    initFormulario();
  });
})();
