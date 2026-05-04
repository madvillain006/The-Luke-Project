'use strict';

const SOURCE_FAMILIES = {
  SATY: 'saty',
  MANCINI: 'mancini',
  DUBZ_STRUCTURAL: 'dubz_structural',
  DUBZ_CALLOUT: 'dubz_callout',
  HEATMAP_GEX: 'heatmap_gex',
  KATBOT_CONTEXT: 'katbot_context',
  MARKET_DATA: 'market_data',
  UNKNOWN: 'unknown',
};

const TRANSPORTS = ['bobby', 'katbot', 'jefe', 'mathemeatloaf', 'manual', 'discord', 'unknown'];

function compactText(...parts) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function normalizeTransport(value, context = {}) {
  const text = compactText(value, context.transport, context.raw_path, context.id, context.source_type, context.tags?.join?.(' '));
  if (text.includes('mathemeatloaf') || text.includes('mathe')) return 'mathemeatloaf';
  if (text.includes('jefe')) return 'jefe';
  if (text.includes('katbot') || text.includes('/kat/') || text.includes('raw-feed')) return 'katbot';
  if (text.includes('bobby')) return 'bobby';
  if (text.includes('discord')) return 'discord';
  if (text.includes('manual')) return 'manual';
  return 'unknown';
}

function normalizeSourceFamily(value, context = {}) {
  const text = compactText(
    value,
    context.source,
    context.source_type,
    context.level_type,
    context.label,
    context.role,
    context.tags?.join?.(' '),
    context.commentary,
  );

  if (text.includes('saty')) return SOURCE_FAMILIES.SATY;
  if (text.includes('mancini')) return SOURCE_FAMILIES.MANCINI;
  if (
    text.includes('bobby_heatmap') ||
    text.includes('bobby_gex') ||
    text.includes('heatseeker') ||
    text.includes('jefe_heatmap') ||
    text.includes('mathemeatloaf_heatmap') ||
    text.includes('katbot_heatmap') ||
    text.includes('katbot_gex') ||
    text.includes('heatmap') ||
    text.includes('gex') ||
    text === 'bobby' ||
    (text.includes('bobby') && (text.includes('session_derived') || text.includes('bobby_text') || text.includes('node')))
  ) {
    return SOURCE_FAMILIES.HEATMAP_GEX;
  }
  if (text.includes('dubz') || text.includes('ximes')) {
    if (text.includes('callout') || text.includes('target') || text.includes('resistance') || text.includes('support')) return SOURCE_FAMILIES.DUBZ_CALLOUT;
    return SOURCE_FAMILIES.DUBZ_STRUCTURAL;
  }
  if (text.includes('katbot')) return SOURCE_FAMILIES.KATBOT_CONTEXT;
  if (text.includes('market')) return SOURCE_FAMILIES.MARKET_DATA;
  return SOURCE_FAMILIES.UNKNOWN;
}

function lifecycleForFamily(family) {
  const normalized = normalizeSourceFamily(family);
  if (normalized === SOURCE_FAMILIES.SATY) return 'daily_structural_ladder';
  if (normalized === SOURCE_FAMILIES.MANCINI) return 'structural_commentary_persistent';
  if (normalized === SOURCE_FAMILIES.DUBZ_STRUCTURAL) return 'carry_forward_structural';
  if (normalized === SOURCE_FAMILIES.DUBZ_CALLOUT) return 'same_day_freshness_sensitive';
  if (normalized === SOURCE_FAMILIES.HEATMAP_GEX) return 'intraday_snapshot_expires_supersedes';
  if (normalized === SOURCE_FAMILIES.KATBOT_CONTEXT) return 'secondary_context';
  if (normalized === SOURCE_FAMILIES.MARKET_DATA) return 'market_data';
  return 'unknown';
}

function normalizeRole(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('chop') || text.includes('veto')) return 'chop_or_veto';
  if (text.includes('target') || text.includes('resistance') || text.includes('call')) return 'target_or_resistance';
  if (text.includes('support') || text.includes('trigger') || text.includes('reclaim') || text.includes('flip')) return 'support_or_trigger';
  if (text.includes('atr')) return 'atr_level';
  return text || 'level';
}

function normalizeLevelEvent(event = {}, level = {}) {
  const source = level.source || event.source || 'unknown';
  const family = normalizeSourceFamily(source, {
    ...event,
    source,
    level_type: level.level_type,
    label: level.label,
    role: level.role,
  });
  const transport = normalizeTransport(source, event);
  return {
    source_family: family,
    source,
    transport,
    lifecycle: lifecycleForFamily(family),
    role: normalizeRole(level.role || level.label || event.source_type),
  };
}

module.exports = {
  SOURCE_FAMILIES,
  TRANSPORTS,
  normalizeSourceFamily,
  normalizeTransport,
  lifecycleForFamily,
  normalizeRole,
  normalizeLevelEvent,
};
