/**
 * Componentes de ícone inline — Preact.
 *
 * Por que não importar lucide-react?
 *   Adicionaria ~20kb ao bundle do content script. Como usamos apenas
 *   uns 6 ícones, inline é 10x mais leve. Todos copiados do Lucide
 *   (stroke-width 1.5 conforme doc 11).
 */

import { h, JSX } from 'preact';

type IconProps = {
  size?: number;
  color?: string;
  class?: string;
};

const defaults = {
  size: 18,
  color: 'currentColor',
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg'
};

function make(path: JSX.Element): (props: IconProps) => JSX.Element {
  return ({ size = defaults.size, color = defaults.color, class: className }) =>
    h(
      'svg',
      {
        xmlns: defaults.xmlns,
        viewBox: defaults.viewBox,
        width: size,
        height: size,
        fill: defaults.fill,
        stroke: color,
        'stroke-width': defaults.strokeWidth,
        'stroke-linecap': defaults.strokeLinecap,
        'stroke-linejoin': defaults.strokeLinejoin,
        class: className
      },
      path
    );
}

export const IconX = make(
  h('path', { d: 'M18 6L6 18M6 6l12 12' })
);

export const IconPhone = make(
  h('path', {
    d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'
  })
);

export const IconPlus = make(
  h('path', { d: 'M12 5v14M5 12h14' })
);

export const IconMessageCircle = make(
  h('path', {
    d: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'
  })
);

export const IconUser = make(
  h('g', {}, [
    h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
    h('circle', { cx: '12', cy: '7', r: '4' })
  ])
);

export const IconCheck = make(
  h('path', { d: 'M20 6L9 17l-5-5' })
);

export const IconMail = make(
  h('g', {}, [
    h('path', { d: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z' }),
    h('polyline', { points: '22,6 12,13 2,6' })
  ])
);

export const IconCalendar = make(
  h('g', {}, [
    h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' }),
    h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    h('line', { x1: '8', y1: '2', x2: '8', y2: '6' }),
    h('line', { x1: '3', y1: '10', x2: '21', y2: '10' })
  ])
);

export const IconChevronRight = make(
  h('polyline', { points: '9,18 15,12 9,6' })
);

export const IconSun = make(
  h('g', {}, [
    h('circle', { cx: '12', cy: '12', r: '4' }),
    h('path', {
      d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'
    })
  ])
);

export const IconMoon = make(
  h('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })
);

export const IconAlertTriangle = make(
  h('g', {}, [
    h('path', {
      d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'
    }),
    h('path', { d: 'M12 9v4' }),
    h('path', { d: 'M12 17h.01' })
  ])
);

export const IconClock = make(
  h('g', {}, [
    h('circle', { cx: '12', cy: '12', r: '10' }),
    h('polyline', { points: '12,6 12,12 16,14' })
  ])
);

export const IconMoreVertical = make(
  h('g', {}, [
    h('circle', { cx: '12', cy: '12', r: '1' }),
    h('circle', { cx: '12', cy: '5', r: '1' }),
    h('circle', { cx: '12', cy: '19', r: '1' })
  ])
);

export const IconCheckCircle = make(
  h('g', {}, [
    h('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
    h('polyline', { points: '22,4 12,14.01 9,11.01' })
  ])
);

export const IconTrash = make(
  h('g', {}, [
    h('polyline', { points: '3,6 5,6 21,6' }),
    h('path', {
      d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
    })
  ])
);

export const IconEdit = make(
  h('g', {}, [
    h('path', { d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }),
    h('path', { d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' })
  ])
);

export const IconChevronDown = make(
  h('polyline', { points: '6,9 12,15 18,9' })
);
