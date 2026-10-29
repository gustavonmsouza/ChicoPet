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
tools/            script que recorta sprites das folhas PNG (Python padrão, sem dependências)
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
Janela transparente sem moldura, sempre no topo, arrastar, clicar, balão de fala, estados comportamentais,
movimento autônomo gradual pela área útil do monitor, pausas, sono, curiosidade, corrida curta, reação a cliques,
ocultar/mostrar, tray e reposicionamento ao mudar de monitor. O processo principal é o único controlador da posição;
enquanto o mascote é arrastado, o movimento autônomo fica suspenso e retoma após uma pausa. A janela inicia no chão
virtual, calculado pela área útil do monitor e por `groundMargin`; ao soltar no ar, cai com gravidade limitada, aterrissa
e passa por recuperação. Arrastar durante a queda cancela a física. Caminhada e atividades de repouso são restritas ao chão.

## Recursos gráficos e limitações
As três folhas enviadas foram recortadas em 50 PNGs RGBA individuais em `assets/sprites/extracted/`, com manifesto
de origem e coordenadas. O recorte remove o fundo xadrez/branco conectado às bordas e o halo vermelho da primeira
folha, preservando a paleta sombreada original do Chico em vez de aplicar uma recoloração que apague os detalhes.
As poses extraídas agora alimentam ciclos de caminhada e corrida e as sequências de queda, aterrissagem e recuperação.

Para animações reais, criar spritesheets transparentes com células de tamanho uniforme e origem alinhada: idle (2–4
quadros de respiração/piscar), walk (4–6 quadros com patas alternadas), run (4–6 quadros com passada aérea), sleep
(2–3 quadros de respiração), happy (3–5 quadros de pequeno pulo/cauda) e curious (2–3 quadros de cabeça/olhar).
As poses devem manter silhueta, escala e ponto de contato no chão consistentes, com o Chico olhando para a direita.

Ainda não há interface de conversa nem ação de clique duplo implementada. A janela foi verificada por análise e testes
automatizados de lógica; este ambiente não valida visualmente a janela transparente no macOS.

### Queda e catálogo de animações
`src/renderer/scripts/animations.js` cataloga estados, quadros, velocidade, repetição, prioridade e variações;
`animationPlayer.js` controla uma sequência por vez e cancela o timer ao trocar ou ocultar a janela. As sequências
usam as poses reais recortadas da folha enviada, incluindo queda de patas para cima, rolamento, aterrissagem e volta
à posição sentada.
O controlador mantém a direção da última caminhada, atualiza-a pelos movimentos horizontais do arraste e escolhe a
variante correspondente: direita mantém a orientação da arte e esquerda a espelha. A limpeza de fundo e de bordas
é aplicada igualmente às três fontes; detalhes de pelo e iluminação são preservados para manter a aparência pixel art.
