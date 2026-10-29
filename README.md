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
assets/sprites/chico*.png  folhas-fonte originais, preservadas sem alteração
assets/sprites/final/      frames usados pelo app: RGBA, canvas e paleta comuns
assets/icons/     ícones da barra de menus
src/main/         processo principal: janela, tray, IPC
src/preload/      ponte segura entre a página e o processo principal
src/renderer/     página: HTML, CSS, sprites, estados, personalidade
tests/            testes unitários
tools/            gerador determinístico dos sprites finais (Python padrão, sem dependências)
```

## Como substituir os sprites
As folhas-fonte ficam em `assets/sprites/chico1.png`, `chico2.png` e `chico3.png`. Para reconstruir os
arquivos de runtime, execute:

```bash
python3 tools/build_normalized_sprites.py
```

O gerador conserva as fontes, remove os fundos, alinha os pés ao chão quando a pose está em pé e escreve frames
RGBA em um canvas fixo de 640×512. Ele também usa uma paleta compartilhada para que caminhada, queda e repouso
tenham as mesmas cores. O tamanho na tela é controlado por `SPRITE_SCALE` em `src/renderer/scripts/config.js`.

## Segurança
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restritiva, preload com 5 funções,
IPC validado (origem e tipo), navegação e janelas novas bloqueadas.

## Limitações conhecidas
- Testado em Linux (Xvfb) com mouse real; ainda não validado em macOS.
- Pode não aparecer sobre apps em tela cheia do macOS.
- A área de clique do Chico é o retângulo da imagem (não o contorno exato).
- Mensagens ainda são locais; sem IA.

## Implementado
Janela transparente sem moldura, sempre no topo, arrastar, clicar, balão de fala, estados comportamentais,
movimento autônomo gradual pela área útil do monitor, pausas, sono, curiosidade, corrida curta, reação a cliques,
ocultar/mostrar, tray e reposicionamento ao mudar de monitor. O processo principal é o único controlador da posição;
enquanto o mascote é arrastado, o movimento autônomo fica suspenso e retoma após uma pausa. A janela inicia no chão
virtual, calculado pela área útil do monitor e por `groundMargin`; ao soltar no ar, cai com gravidade limitada, aterrissa
e passa por recuperação. Arrastar durante a queda cancela a física. Caminhada e atividades de repouso são restritas ao chão.

## Recursos gráficos e limitações
As poses utilizadas pelo app são geradas em `assets/sprites/final/`. Cada frame tem fundo transparente, canvas de
640×512, linha de chão comum e uma paleta única. O gerador remove o fundo branco/xadrez inclusive nos espaços entre
as patas e limpa a borda neutra deixada pelas folhas-fonte. Isso impede flashes de tamanho, manchas de fundo e trocas
de tom quando uma animação avança.

O catálogo usa quatro poses de caminhada, quatro de corrida, cinco de queda, aterrissagem, recuperação e poses de
repouso. As sequências esquerda e direita são arquivos físicos distintos, gerados por espelhamento controlado da
mesma pose fonte; o renderer não aplica uma inversão CSS global.

Ainda não há interface de conversa nem ação de clique duplo implementada. A janela foi verificada por análise e testes
automatizados de lógica; este ambiente não valida visualmente a janela transparente no macOS.

### Queda e catálogo de animações
`src/renderer/scripts/animations.js` cataloga estados, quadros, velocidade, repetição, prioridade e variações;
`animationPlayer.js` controla uma sequência por vez e cancela o timer ao trocar ou ocultar a janela. As sequências
usam as poses reais recortadas da folha enviada, incluindo queda de patas para cima, rolamento, aterrissagem e volta
à posição sentada.
O controlador mantém a direção da última caminhada, atualiza-a pelos movimentos horizontais do arraste e escolhe a
variante correspondente. Assim, ao soltar o Chico depois de movê-lo para a direita, ele usa a sequência de queda à
direita; para a esquerda, usa a sequência esquerda. Os testes validam a existência desses arquivos separados, o canvas
comum, o canal alfa, a paleta compartilhada e a ausência de pixels claros de fundo.
