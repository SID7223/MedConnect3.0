/**
 * Analytics stub — ST cross-cutting (~15 events).
 *
 * No provider is configured yet (founder decision pending), so this is a
 * local no-op sink with a single seam: call `analytics.track(name, props)`
 * everywhere; when a provider is chosen, replace the body of `emit` only.
 * Events are also buffered in-memory for QA (`recent()`).
 */

export type AnalyticsEvent =
  | 'home_viewed'
  | 'next_best_step_tapped'
  | 'toolkit_tapped'
  | 'mcq_subject_opened'
  | 'wrong_questions_shared'
  | 'study_goal_set'
  | 'study_session_started'
  | 'study_goal_met'
  | 'daily_card_opened'
  | 'daily_card_completed'
  | 'oneliner_reference_open'
  | 'partners_strip_tapped'
  | 'feed_card_tapped'
  | 'resources_link_opened'
  | 'tracker_viewed'
  | 'qbank_viewed'
  | 'logbook_viewed'
  | 'essentials_viewed';

const buffer: { name: AnalyticsEvent; props?: Record<string, unknown>; at: number }[] = [];

function emit(name: AnalyticsEvent, props?: Record<string, unknown>) {
  // PROVIDER SEAM: forward to Segment/Mixpanel/Firebase here when chosen.
  if (__DEV__) {
    console.log(`[analytics] ${name}`, props || '');
  }
  buffer.push({ name, props, at: Date.now() });
  if (buffer.length > 200) buffer.shift();
}

export const analytics = {
  track: emit,
  recent: () => [...buffer],
};
