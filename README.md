# Chico Desktop Companion

Um mascote em pixel art, inspirado no Yorkshire Terrier Chico, que vive na área de trabalho do macOS.

## Tecnologias
Electron 45 · Node.js 22.12+ · HTML/CSS/JavaScript (módulos ES). Sem IA, banco de dados ou voz nesta versão.

## Requisitos
- macOS (Apple Silicon ou Intel)
- Node.js 22.12 ou superior (`node -v`) e npm (`npm -v`)

## Como executar
```bash
npm install
npm start
npm test        # testes unitários (node:test)
```

## Como usar
- Arraste o Chico com o botão esquerdo.
- Clique nele: ele fica feliz e fala algo.
- Botão direito (ou ctrl+clique): menu para esconder, trocar de pose (teste) ou sair.
- Ícone na barra de menus: clique mostra/esconde; botão direito abre o menu.

## Estrutura
```
assets/sprites/   idle, walk, happy, sleep (PNG com transparência, todos olhando para a direita)
assets/icons/     ícones da barra de menus
src/main/         processo principal: janela, tray, IPC
src/preload/      ponte segura entre a página e o processo principal
src/renderer/     página: HTML, CSS, sprites, estados, personalidade
tests/            testes unitários
tools/            script que recorta os sprites da imagem de referência (Python + Pillow)
```

## Como substituir os sprites
Troque os PNGs em `assets/sprites/` mantendo os nomes. Regras: fundo transparente, sem sombra embutida,
personagem olhando para a direita, pés encostando na borda inferior da imagem.
O tamanho na tela é controlado por `SPRITE_SCALE` em `src/renderer/scripts/config.js`.

## Segurança
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restritiva, preload com 5 funções,
IPC validado (origem e tipo), navegação e janelas novas bloqueadas.

## Limitações conhecidas
- Testado em Linux (Xvfb) com mouse real; ainda não validado em macOS.
- Pode não aparecer sobre apps em tela cheia do macOS.
- A área de clique do Chico é o retângulo da imagem (não o contorno exato).
- Mensagens ainda são locais; sem IA.

## Implementado
Janela transparente sem moldura, sempre no topo, arrastar, clicar, balão de fala, estados IDLE/HAPPY (e poses de teste),
ocultar/mostrar, tray, reposicionamento ao mudar de monitor.

## Planejado
Animação por quadros, caminhada, sono por inatividade, janela de conversa, provedores de IA, memória (SQLite), voz, empacotamento.
