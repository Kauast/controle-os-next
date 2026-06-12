# Design System RB

## Tipografia

| Propriedade | Valor |
|---|---|
| Font | Inter |
| Peso regular | 400 |
| Peso médio | 500 |
| Peso bold | 600 |

---

## Bordas

| Token | Valor |
|---|---|
| Radius LG | 18px |
| Radius MD | 14px |
| Radius SM | 10px |

---

## Paleta de Cores

### Base

| Nome | Hex / Rgba | Uso |
|---|---|---|
| Background | `#000000` | Fundo global da aplicação |
| Panel | `#101010` | Painéis, sidebars |
| Panel Soft | `#1a1a1a` | Cards, áreas secundárias |
| Foreground | `#f0f2f5` | Texto principal |
| Muted | `#71717a` | Texto secundário, labels |
| Border | `rgba(255,255,255,0.1)` | Divisores, bordas de cards |
| Line | `rgba(255,255,255,0.1)` | Separadores visuais |

### Semânticas

| Nome | Hex | Soft | Uso |
|---|---|---|---|
| Primary (Teal) | `#14b8a6` | `rgba(20,184,166,0.12)` | Ação principal, status ativo |
| Success | `#22c55e` | `rgba(34,197,94,0.12)` | Conclusão, OS finalizada |
| Warning (Amber) | `#fbbf24` | `rgba(251,191,36,0.12)` | Atenção, prazo próximo |
| Danger (Red) | `#ef4444` | `rgba(239,68,68,0.12)` | Erro, crítico, atrasado |

### Referência rápida

```
Primary:    #14B8A6
Background: #000000
Panel:      #101010
Cards:      #1A1A1A
Success:    #22C55E
Warning:    #F59E0B
Danger:     #EF4444
Text:       #F0F2F5
Muted:      #71717A
```

---

## Efeitos

| Token | Valor |
|---|---|
| Shadow Panel | `0 18px 45px rgba(0,0,0,0.5)` |
| Ring | `#fbbf24` |

---

## Componentes

### Botão primário
- Background: `#14b8a6`
- Texto: `#000000`
- Radius: 10px
- Hover: leve aumento de brilho

### Badge de status
- Usar a versão `*-soft` como background + cor semântica como texto
- Ex: OS em andamento → bg `rgba(20,184,166,0.12)` + texto `#14b8a6`

### Card
- Background: `#1a1a1a`
- Border: `rgba(255,255,255,0.1)`
- Radius: 18px
- Shadow: `0 18px 45px rgba(0,0,0,0.5)`

---

## Variáveis CSS

Todas as variáveis estão definidas em `src/app/globals.css` como custom properties CSS.
Nunca usar valores hardcoded — sempre referenciar as variáveis.
