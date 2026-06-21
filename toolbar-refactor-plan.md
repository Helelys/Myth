# Plano de Refatoração da Toolbar

## Problemas identificados
1. Ícones SVG não renderizam (Angular sanitiza [innerHTML])
2. Botão "Mover" é redundante (Select já move)
3. Fog atual é canvas-based (frágil, sem shapes persistíveis)
4. Layer order incorreta (Fog em cima de Tokens)
5. ToolType muito complexo (7 tipos, só 2 necessários)

## Solução

### 1. Ferramentas simplificadas
ToolMode = 'select' | 'fog-rectangle' | 'fog-brush'

### 2. Toolbar final
- 🖱 Selecionar (select) - padrão
- 🌫 Esconder (abre submenu: ▭ Retângulo | ✏ Caneta)

### 3. Fog como shapes (Konva shapes)
FogShape = { id, type: 'rectangle'|'brush', x, y, width, height, points }

### 4. Layer order corrigida
Grid → Maps → Fog → Tokens → UI

### 5. Ícones inline no template (sem [innerHTML])

## Arquivos a modificar

1. `models/tool.model.ts` - Simplificar ToolType
2. `models/fog.model.ts` - Adicionar FogShape
3. `services/fog.service.ts` - Gerenciar shapes
4. `services/tool.service.ts` - Ajustar
5. `renderers/fog.renderer.ts` - Rewrite completo
6. `tabletop-canvas.component.ts` - Toolbar + eventos fog
