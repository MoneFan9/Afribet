"use strict";
const TAILLE_CAMP = 7;
class SongoBoard {
    constructor(root) {
        this.state = null;
        this.status = "ACTIVE";
        this.root = root;
        this.statusEl = document.getElementById("status");
        this.myIndex = parseInt(root.dataset.myindex || "0", 10);
        const initialEl = document.getElementById("initial-state");
        if (initialEl && initialEl.textContent) {
            try {
                this.state = JSON.parse(initialEl.textContent);
            }
            catch { /* ignore */ }
        }
        const token = root.dataset.token || "";
        const matchId = root.dataset.match || "";
        const scheme = location.protocol === "https:" ? "wss" : "ws";
        this.socket = new WebSocket(`${scheme}://${location.host}/ws/match/${matchId}/?token=${token}`);
        this.socket.onopen = () => this.setStatus("connecté");
        this.socket.onclose = () => this.setStatus("déconnecté — reconnexion…");
        this.socket.onmessage = (e) => this.onMessage(JSON.parse(e.data));
        const forfeit = document.getElementById("btn-forfeit");
        if (forfeit)
            forfeit.addEventListener("click", () => this.send({ action: "forfeit" }));
        this.render();
    }
    setStatus(text) { this.statusEl.textContent = text; }
    onMessage(msg) {
        if (msg.type === "error") {
            this.setStatus(msg.detail || "erreur");
            return;
        }
        if (msg.game_state)
            this.state = msg.game_state;
        if (msg.status)
            this.status = msg.status;
        if (this.status === "COMPLETED") {
            this.setStatus(msg.winner ? "Terminé" : "Terminé (nul)");
        }
        else if (this.state) {
            const mine = this.state.current_player === this.myIndex;
            this.setStatus(mine ? "À vous de jouer" : "Tour de l'adversaire");
        }
        this.render();
    }
    send(payload) {
        if (this.socket.readyState === WebSocket.OPEN)
            this.socket.send(JSON.stringify(payload));
    }
    /** Indices des trous appartenant au joueur d'index `idx`. */
    holesOf(idx) {
        const start = idx === 0 ? 0 : TAILLE_CAMP;
        return Array.from({ length: TAILLE_CAMP }, (_, i) => start + i);
    }
    render() {
        if (!this.state)
            return;
        const s = this.state;
        const myTurn = this.status === "ACTIVE" && s.current_player === this.myIndex;
        const oppIdx = 1 - this.myIndex;
        const row = (idx, clickable) => this.holesOf(idx).map((h) => {
            const seeds = s.plateau[h];
            const cls = "songo-hole rounded-full bg-sable text-vert font-bold flex items-center " +
                "justify-center h-12 w-12 m-1 shadow" + (clickable && seeds > 0 ? " ring-2 ring-or" : "");
            const attr = clickable ? ` data-move="${h}"` : "";
            return `<div class="${cls}"${attr}>${seeds}</div>`;
        }).join("");
        this.root.innerHTML = `
      <div class="text-or text-xs text-center mb-1">Adversaire · grenier ${s.greniers[oppIdx]}</div>
      <div class="flex justify-center flex-row-reverse">${row(oppIdx, false)}</div>
      <div class="flex justify-center my-1">${row(this.myIndex, myTurn)}</div>
      <div class="text-or text-xs text-center mt-1">Vous · grenier ${s.greniers[this.myIndex]}</div>`;
        if (myTurn) {
            this.root.querySelectorAll("[data-move]").forEach((el) => {
                el.addEventListener("click", () => this.send({ action: "play", move: parseInt(el.dataset.move, 10) }));
            });
        }
    }
}
const boardEl = document.getElementById("board");
if (boardEl)
    new SongoBoard(boardEl);
