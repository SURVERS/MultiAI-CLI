<!-- apps/multiai-web/src/components/chat/MentionMenu.vue -->
<!-- Popup list of file paths shown when user types @ in the Composer textarea. -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Icon from '../ui/Icon.vue';
import type { IconName } from '../../lib/icons';
import type { FileItem } from '../../types';

// Re-exported for the .vue consumers (Composer / ChatDock / ConversationPane)
// that import FileItem from this component.
export type { FileItem };

const props = defineProps<{
  items: FileItem[];
  activeIndex: number;
  loading: boolean;
}>();

const emit = defineEmits<{
  select: [item: FileItem];
  hover: [index: number];
}>();

const { t } = useI18n();

// ---------------------------------------------------------------------------
// File-type glyphs: icon-catalog names rendered via <Icon>, keyed off the
// extension. Categories: folder, code, doc/markdown, image, generic.
// Subtle + muted; never an emoji, never v-html.
// ---------------------------------------------------------------------------

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'json', 'py', 'go', 'rs',
  'java', 'kt', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'rb', 'php', 'swift',
  'sh', 'bash', 'zsh', 'css', 'scss', 'less', 'html', 'htm', 'xml', 'sql',
  'yaml', 'yml', 'toml', 'lua', 'dart', 'scala', 'clj', 'ex', 'exs',
]);
const DOC_EXT = new Set(['md', 'markdown', 'mdx', 'txt', 'rst', 'adoc', 'pdf', 'doc', 'docx']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif']);

function fileIcon(item: FileItem): IconName {
  const path = item.path;
  // Trailing slash → folder.
  if (path.endsWith('/')) return 'folder';
  const base = item.name || path.split('/').pop() || path;
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  if (!ext) return 'file';
  if (CODE_EXT.has(ext)) return 'code';
  if (DOC_EXT.has(ext)) return 'file-text';
  if (IMAGE_EXT.has(ext)) return 'image';
  return 'file';
}
</script>

<template>
  <div class="mention-menu" role="listbox">
    <!-- Loading state -->
    <div v-if="props.loading" class="mention-state dim">{{ t('mention.searching') }}</div>

    <!-- Empty state (not loading, no items) -->
    <div v-else-if="props.items.length === 0" class="mention-state dim">{{ t('mention.noMatch') }}</div>

    <!-- File items -->
    <div
      v-for="(item, i) in props.items"
      v-else
      :key="item.path"
      class="mention-item"
      :class="{ active: i === props.activeIndex }"
      role="option"
      :aria-selected="i === props.activeIndex"
      @mouseenter="emit('hover', i)"
      @mousedown.prevent="emit('select', item)"
    >
      <!-- file-type glyph (line-SVG via <Icon>, no v-html) -->
      <Icon :name="fileIcon(item)" size="sm" class="mention-icon" aria-hidden="true" />
      <span class="mention-name">{{ item.name }}</span>
      <span class="mention-path">{{ item.path }}</span>
    </div>
  </div>
</template>

<style scoped>
/* `[role="listbox"]` raises specificity (0,3,0) so the redesign's surface +
   shadow-md win over any global menu styles. */
.mention-menu[role="listbox"] {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  right: 0;
  padding: var(--space-1);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  z-index: var(--z-dropdown);
  max-height: 220px;
  overflow-y: auto;
}

.mention-state {
  padding: 8px 12px;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
}

.dim {
  color: var(--color-text-muted);
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
}

.mention-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--color-text-faint);
  flex-shrink: 0;
}

/* Pin every glyph to the same 14px box so rows line up regardless of icon kind. */
.mention-icon :deep(svg) {
  width: 13px;
  height: 13px;
  display: block;
}

.mention-item:hover .mention-icon,
.mention-item.active .mention-icon {
  color: var(--color-text-muted);
}

.mention-item:hover {
  background: var(--color-surface-sunken);
}
.mention-item.active {
  background: var(--color-accent-soft);
}

.mention-name {
  color: var(--color-text);
  font-weight: 500;
  min-width: 80px;
  flex-shrink: 0;
}

.mention-path {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Menu surface defaults ---- */
.mention-menu { border-radius: var(--radius-lg); box-shadow: var(--sh); }
.mention-state { font-family: var(--sans); }
</style>
