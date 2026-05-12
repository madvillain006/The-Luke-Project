# Mancini Direct Failed-Breakdown Source Audit

Generated: 2026-05-12

Scope: raw-source review only. No trading authority. No Ninja/shadow trigger promotion.

Quant gate used here:
- direct raw passage must identify failed-breakdown style price action, not only a support/resistance row
- actual setup level must coincide with same-plan support/resistance/prose context
- existing ES 1m window, when available, must show a sweep below level and reclaim close above level
- existing visual sanity audit must mark a matched chart as training_candidate before this report can mark a row positive
- non-acceptance is treated as source-confirmation only when source states +5 and local window can show the threshold hold
- support-list-only rows stay rejected unless tied to explicit flush/recover language

## Verdict Counts

- `data_only`: 332
- `needs_bigger_crop`: 114
- `negative_control`: 32

## Strict Positive Groups

No strict positive groups passed.

## Direct Passage Rows

### data\research\mancini\Longer Mancini Logs 2.txt:8 `needs_bigger_crop`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: actual_recap
- Levels: setup=6689.0; swept/lost=none; recovered=6689.0; non_acceptance=none; invalidation=none; target/response=6743.0
- Level roles: 6689.0=actual_setup_level+recovered_level; 6819.0=current_price_context; 6743.0=target_or_response; 6754.0=current_price_context; 6766.0=current_price_context
- Time mentions: 4pm, 6pm, 7pm
- S/R coincidence: 6689.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\040_accepted_non_acceptance_protocol_20260318_0823_6689.0.svg trap=6683.25 reclaim=2026-03-18T08:17:00-04:00 threshold_hold=5 visual=review_only_context overlap=15
- Blockers: no_source_stated_swept_low_below_setup, visual_sanity_review_only_context
- Source: The task for bulls this week if they wanted a rally would therefore be twofold. 1) To start a squeeze, they’d need to put in a Failed Breakdown and to do this, theyd need to recover 6689 which was a big shelf all day Friday. 2) If they wanted to sustain a rally, they’d need to backtest then recover 6819. I wrote on Friday at 4pm: “My general lean is ES ca...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...

### data\research\mancini\Longer Mancini Logs 2.txt:10 `data_only`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: actual_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6808.0
- Level roles: 6819.0=current_price_context; 6689.0=current_price_context; 6743.0=current_price_context; 6735.0=current_price_context; 6808.0=target_or_response
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The question for today was if bulls could keep this bounce going to backtest towards 6819. My lean was they could. I wrote yesterday at 4pm: “The bull case for tomorrow is that ES can keep up the momentum from last evenings 6689-90 Failed Breakdown, and run to backtest 6819. I discussed entries for this leg above, but in a strong bull case, ES will hold 6...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-13, 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19

### data\research\mancini\Longer Mancini Logs 2.txt:37 `needs_bigger_crop`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: planned_setup
- Levels: setup=6764.0, 6658.0, 6635.0, 6689.0, 6735.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6689.0=actual_setup_level; 6735.0=actual_setup_level; 6770.0=current_price_context; 6764.0=actual_setup_level; 6749.0=current_price_context; 6727.0=current_price_context; 6716.0=current_price_context; 6703.0=current_price_context; 6673.0=current_price_context; 6658.0=actual_setup_level; 6635.0=actual_setup_level; 6623.0=current_price_context; 6593.0=current_price_context
- Time mentions: 7:30AM, 2am
- S/R coincidence: 6764.0=coincides_partially; 6658.0=coincides_partially; 6635.0=coincides_partially; 6689.0=coincides_partially; 6735.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 6635.0:artifacts\research\mancini-real-packet-gallery\030_excluded_non_acceptance_protocol_20260318_1441_6635.0.svg visual=dangerous_demote_for_training; 6658.0:artifacts\research\mancini-real-packet-gallery\034_excluded_non_acceptance_protocol_20260318_1338_6658.0.svg visual=dangerous_demote_for_training; 6689.0:artifacts\research\mancini-real-packet-gallery\040_accepted_non_acceptance_protocol_20260318_0823_6689.0.svg visual=review_only_context; 6735.0:artifacts\research\mancini-real-packet-gallery\050_accepted_simple_reclaim_unclassified_20260317_2103_6735.0.svg visual=insufficient_visual_context
- Blockers: multi_setup_row_split_required, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from Sunday evenings 6689 Failed Breakdown. My most recent entry was 6735 Failed Breakdown entry that I took this morning at 7:30AM, discussed above. Please read the FOMC guide at the start of this newsletter as well, this is key for trading tomorrow. First support down heading into to...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...

### data\research\mancini\Longer Mancini Logs 2.txt:41 `data_only`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6815.0=current_price_context; 6819.0=current_price_context; 6689.0=current_price_context; 6854.0=current_price_context; 6882.0=current_price_context; 6980.0=current_price_context; 6770.0=current_price_context; 6764.0=current_price_context; 6802.0=current_price_context; 6785.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Bears remain in control and this is true until 6815-19 recovers. This was a support shelf from Monday to Wednesday this week, which broke down on Thursday and we sold. While bears remain in control remember that does not mean we won’t have large rips. ON the contrary, the biggest squeezes occur in contexts where bears control because t...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-13, 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19

### data\research\mancini\Longer Mancini Logs 2.txt:43 `negative_control`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6672.0=current_price_context; 6665.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Bear case tomorrow: In order to see a real leg lower, 6672 must fail. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute,...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-13, 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19

### data\research\mancini\Longer Mancini Logs 2.txt:45 `data_only`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: context_recap
- Levels: setup=6689.0; swept/lost=6689.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6689.0=actual_setup_level+swept_lost_low; 6770.0=current_price_context; 6785.0=current_price_context; 6802.0=current_price_context; 6815.0=current_price_context
- Time mentions: none
- S/R coincidence: 6689.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\040_accepted_non_acceptance_protocol_20260318_0823_6689.0.svg trap=6683.25 reclaim=2026-03-18T08:17:00-04:00 threshold_hold=5 visual=review_only_context overlap=6
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap, visual_sanity_review_only_context
- Source: In summary for tomorrow: Tomorrow is FOMC day. This are basically coin tosses so I can only give my lean as if it were a normal day. On a normal day my lean is that on Sunday after the open ES put in a monster Failed Breakdown when we flushed the 6689 shelf of lows that we set last Friday, recovered, and ripped. My lean is this can keep going. Bulls want ...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...

### data\research\mancini\Longer Mancini Logs 2.txt:49 `needs_bigger_crop`

- Context: FOMC Tomorrow. Can The New SPX Rally Survive? March 18 Plan | pub=2026-03-17 | plan=2026-03-18
- Source mode: actual_recap
- Levels: setup=6612.0; swept/lost=6588.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6588.0=swept_lost_low; 6700.0=current_price_context; 6612.0=actual_setup_level; 6820.0=current_price_context
- Time mentions: 9:25PM, 9pm, 12am
- S/R coincidence: 6612.0=does_not_coincide
- Chart/window: none
- Blockers: no_existing_chart_window_match, setup_level_does_not_coincide_with_sr_or_prose_context
- Source: Sunday/Monday, we saw exactly this. We went elevator down off the futures open Sunday evening due to more bearish war headlines, selling down to 6588 from 6700+. As always though, every elevator down sell in ES resolves in a squeeze, and Sunday evening was no different. At 9:25PM Sunday, I live tweeted that the 6612 recovery starts us higher. 6612 was whe...
- Nearest support context: line 35: Supports are: 6775, 6770 (major), 6766, 6760 (major), 6752, 6749 (major), 6743, 6734, 6727 (major), 6717, 6713 (major), 6708, 6703 (major), 6696, 6690 (major), 6686, 6678 (major), 6672 (major), 6667, 6662 (major), 6655, 6648 (major), 6639, 6632, 6623 (major), 6614, 6608 (major), 6602, 6593 (major), 6586 (major), 6577, 6572, 6564 (major), 6558, 6543 (major...
- Nearest resistance context: line 39: Resistances are: 6785 (major), 6788, 6792, 6797, 6802 (major), 6810, 6815-19 (major), 6828, 6833, 6840 (major), 6845, 6854 (major), 6864, 6872 (major), 6879, 6882 (major), 6887, 6893, 6899 (major), 6913, 6920 (major), 6926, 6932, 6938 (major), 6944, 6949 (major), 6954, 6959, 6968 (major), 6974, 6980-85 (major), 7001, 7008, 7013, 7020-23 (major), 7027, 703...
- Required crop: render ES 1m from 2026-03-19T09:41:00-04:00 minus 60 minutes through 2026-03-19T14:01:00-04:00 plus 90 minutes; trap_low=6588.0; reclaim=2026-03-19T14:01:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:62 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: actual_recap
- Levels: setup=6612.0; swept/lost=6588.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6588.0=swept_lost_low; 6700.0=current_price_context; 6612.0=actual_setup_level; 6820.0=current_price_context
- Time mentions: 9:25PM, 9pm, 12am
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Sunday/Monday, we saw exactly this. We went elevator down off the futures open Sunday evening due to more bearish war headlines, selling down to 6588 from 6700+. As always though, every elevator down sell in ES resolves in a squeeze, and Sunday evening was no different. At 9:25PM Sunday, I live tweeted that the 6612 recovery starts us higher. 6612 was whe...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-08T21:15:00-04:00 minus 60 minutes through 2026-03-08T22:34:00-04:00 plus 90 minutes; trap_low=6587.75; reclaim=2026-03-08T22:34:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:70 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=6769.0, 6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level; 6769.0=actual_setup_level; 6818.0=current_price_context
- Time mentions: 12:10AM, 9:03AM
- S/R coincidence: 6769.0=coincides_partially; 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 6612 Failed Breakdown we saw at 12:10AM Monday. My most recent entry was the 9:03AM yesterday Failed Breakdown of the 6769 shelf (this ran us to 6818 after CPI yeststerday), and I discussed this in detail in yesterdays newsletter. I verified this positioning at the close yesterday when I ...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:76 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: actual_recap
- Levels: setup=6612.0; swept/lost=6588.0, 6612.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6820.0
- Level roles: 6700.0=current_price_context; 6588.0=swept_lost_low; 6612.0=actual_setup_level+swept_lost_low; 6820.0=target_or_response
- Time mentions: 10pm, 6pm
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw it Sunday evening. More weekend risk over the week, and we went elevator down from 6700+ to 6588 by 10pm Sunday evening. Shortly after - a little after midnight - we got what always comes. A Failed Breakdown. Specifically right off the 6pm futures open Sunday ES sold to 6612 and bounced ~34 points. By 10pm, ES flushed that low down to 6588. A littl...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-08T21:15:00-04:00 minus 60 minutes through 2026-03-08T22:34:00-04:00 plus 90 minutes; trap_low=6587.75; reclaim=2026-03-08T22:34:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:78 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6764.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6769.0=current_price_context; 6764.0=swept_lost_low; 6818.0=current_price_context
- Time mentions: 9am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This strength ultimately continued into Tuesday’s highs 6850 highs. Then yesterday? Since Monday, ES set a major 4 touch shelf of lows at 6769 where we bounced 50-80 points each time. After CPI yesterday at 830AM, we flushed that shelf down to 6764. Shortly after around 9am yesterday, we recovered. This is a Failed Breakdown, and we ripped again to 6818 w...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:80 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: actual_recap
- Levels: setup=6716.0; swept/lost=6705.0, 6758.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6705.0=swept_lost_low; 6716.0=actual_setup_level; 6758.0=swept_lost_low
- Time mentions: 7:30PM, 10pm
- S/R coincidence: 6716.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: From there? We then went elevator down to 6705 overnight. What comes next? The usual Failed Breakdown. At 7:30PM last night ES set a significant low at 6716 and bounced 20 points. We flushed that low to 6705 by 10pm, then recovered it, commencing a Failed Breakdown to 6758 this morning.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-09T10:38:00-04:00 minus 60 minutes through 2026-03-09T11:03:00-04:00 plus 90 minutes; trap_low=6705.0; reclaim=2026-03-09T11:03:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:110 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6769.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We closed up in the middle of some intense congestion around 6769 so there was little to do immediately other than hold our runners from yesterday’s failed breakdowns and wait for the elevator down sell.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:114 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: planned_setup
- Levels: setup=6750.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6750.0=actual_setup_level; 6758.0=current_price_context; 6738.0=current_price_context; 6742.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6750.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry down was the 6750 (yesterday’s daily low) Failed Breakdown. I wrote yesterday at 4pm: “Below 6758 is 6738-42. Remember my core rule in ES: No knife catching allowed. If ES is collapsing full speed into 6742-38 Never buy. If its a slow, controlled sell into the zone one can try but if we are freefalling it is much safer to wait fo ...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-09T08:20:00-04:00 minus 60 minutes through 2026-03-09T14:19:00-04:00 plus 90 minutes; trap_low=6675.75; reclaim=2026-03-09T14:19:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:116 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6750.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At ~6750 we had #1. This was the low of day for Wednesday and the flush and recovery of this would be highly actionable IF we even got it.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:120 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6716.0=current_price_context
- Time mentions: 7:30PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: By 7:30PM we hit 6716. ES spent some time sitting here (for a full hour basically). I don’t directly bid supports (only Failed Breakdowns) but for those who like these this level offered a good 20 points.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:122 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: planned_setup
- Levels: setup=6716.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6705.0=current_price_context; 6716.0=actual_setup_level
- Time mentions: 10:30PM, 7:30PM
- S/R coincidence: 6716.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: We continued lower into 6705 by 10:30PM. There was quite a nice Failed Breakdown available here on the recovery of the 6716 as referenced above. Specifically at 7:30PM ES set a significant low at 6716. This was a clear low from which we bounced 20 points, meaning the flush and recovery of that low would be actionable.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-09T05:04:00-04:00 minus 60 minutes through 2026-03-09T11:03:00-04:00 plus 90 minutes; trap_low=6677.5; reclaim=2026-03-09T11:03:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:133 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6721.0; invalidation=none; target/response=none
- Level roles: 6716.0=current_price_context; 6721.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\026_accepted_non_acceptance_protocol_20260313_0845_6721.0.svg trap=6703.25 reclaim=2026-03-13T08:42:00-04:00 threshold_hold=6 visual=dangerous_demote_for_training visual_reasons=closed_back_below_level_soon_after_reclaim overlap=19
- Blockers: no_actual_setup_level_extracted
- Source: Rememeber the non-acceptance protocol automatically activates when price recovers the significant low (6716) by 5 points (6721) and holds at or above 6721 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typic...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...

### data\research\mancini\Longer Mancini Logs 2.txt:139 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=6699.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6699.0=actual_setup_level
- Time mentions: 10:01AM
- S/R coincidence: 6699.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Thursday Morning And The 10:01AM 6699 Failed Breakdown:
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-12T10:12:00-04:00 minus 60 minutes through 2026-03-12T10:26:00-04:00 plus 90 minutes; trap_low=6687.0; reclaim=2026-03-12T10:26:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:141 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=6750.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6755.0=current_price_context; 6750.0=actual_setup_level; 6760.0=current_price_context
- Time mentions: none
- S/R coincidence: 6750.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: When I woke up and checked price at 730AM we were up at 6755. I’d be willing to take the 6750 Failed Breakdown discussed above if it triggered. There was tons of noise here overnight between 6750-6760 and and as a result we’d want to see all that overnight resistance cleared to get long.
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-09T08:20:00-04:00 minus 60 minutes through 2026-03-09T14:19:00-04:00 plus 90 minutes; trap_low=6675.75; reclaim=2026-03-09T14:19:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:143 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6697.0=current_price_context; 6693.0=current_price_context; 6699.0=current_price_context
- Time mentions: 9:50AM, 4pm, 1:45PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This never happened, and we continued lower into 6697 by 9:50AM. I wrote yesterday at 4pm: “6693 is below there and this is another spot to grab some points. If we are free falling though, the much safer entry here is to wait for this to hold then recover 6699. Why 6699? Because on Monday at 1:45PM, ES set a massive low there from which we rallied into th...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:153 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6758.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember that when bears control, the first several Failed Breakdowns will only go a few levels and reverse, before a larger one sticks. This is normal and expected. Recall that bears took control when the bear case triggered, and I wrote yesterday at 4pm: “Bear case tomorrow: Begins below 6758.”
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:157 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=none; swept/lost=6693.0, 6697.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6693.0=swept_lost_low; 6697.0=swept_lost_low
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We flushed to 6693 after this. Since we lost the initial low (6697) my runner cut out. Remember stops on Failed breakdowns always go below the lowest low of the pattern. Sometimes this low will be taken, your stop will as well, then price will just put in a double dip Failed Breakdown and resume up. If this happens, you can simply add back long when price...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:185 `needs_bigger_crop`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: actual_recap
- Levels: setup=6585.0, 6699.0; swept/lost=6680.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6699.0=actual_setup_level; 6765.0=current_price_context; 6815.0=current_price_context; 6685.0=current_price_context; 6680.0=swept_lost_low; 6663.0=current_price_context; 6652.0=current_price_context; 6641.0=current_price_context; 6624.0=current_price_context; 6612.0=current_price_context; 6585.0=actual_setup_level; 6571.0=current_price_context
- Time mentions: 10:45AM, 11:20AM, 3pm, 10:10AM, 3:05AM
- S/R coincidence: 6585.0=coincides_cleanly; 6699.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 6699.0:artifacts\research\mancini-real-packet-gallery\023_accepted_simple_reclaim_unclassified_20260312_1919_6699.0.svg visual=dangerous_demote_for_training
- Blockers: multi_setup_row_split_required
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 10:45AM 6699 Failed Breakdown, discussed above and provided yesterday. Today was another extreme chop session and as I warned yesterday and again in the paragraphs above - this is only hard to trade if you are trading it. If you simply wait for the big elevator down sell into ...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...

### data\research\mancini\Longer Mancini Logs 2.txt:189 `data_only`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: context_recap
- Levels: setup=6685.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6765.0=current_price_context; 6815.0=current_price_context; 6758.0=current_price_context; 6685.0=actual_setup_level; 6700.0=current_price_context; 6716.0=current_price_context; 6738.0=current_price_context; 6612.0=current_price_context
- Time mentions: 11:20AM, 3pm
- S/R coincidence: 6685.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: All week ES was stuck in a range from 6765 to 6815 mostly. Today, we broke it down. The task for bulls now is twofold. Firstly, to backtest this resistance shelf which is now 6758-65. Secondly, to recover. To get up there though, ES will require a Failed Breakdown. One option here is the Failed Breakdown of 6685 which was a big shelf o...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: render ES 1m from 2026-03-08T22:33:00-04:00 minus 60 minutes through 2026-03-09T04:32:00-04:00 plus 90 minutes; trap_low=6609.5; reclaim=2026-03-09T04:32:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:191 `negative_control`

- Context: SPX Breaks Down, But Is It Another Bear Trap? March 13 Plan | pub=2026-03-12 | plan=2026-03-13
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=current_price_context; 6608.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Bears have the ball. Since we are clsing at the low of day though, it is difficult to provide any good shorts that don’t involve chasing. The 6612 breakdown is one option though. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast...
- Nearest support context: line 183: Supports are: 6685 (major), 6676, 6667, 6663 (major), 6656, 6652 (major), 6646, 6638 (major), 6630, 6624 (major), 6620, 6612 (major), 6608, 6597 (major), 6593, 6585 (major), 6582, 6571 (major), 6564, 6558, 6552 (major), 6546, 6542 (major), 6536 (major), 6527, 6522, 6508 (major), 6498, 6491, 6485, 6475 (major).
- Nearest resistance context: line 187: Resistances are: 6693, 6700 (major), 6704, 6711, 6716 (major), 6726, 6732, 6738 (major), 6752, 6758 (major), 6765 (major), 6769, 6772, 6778-82 (major), 6790, 6794, 6804 (major), 6813, 6820-6822 (major), 6828, 6832 (major), 6839, 6842 (major), 6850, 6856, 6861, 6866 (major), 6876, 6880 (major), 6888, 6893 (major), 6900, 6904, 6909 (major), 6912, 6918, 6925...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-09, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13

### data\research\mancini\Longer Mancini Logs 2.txt:204 `needs_bigger_crop`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: actual_recap
- Levels: setup=6718.0; swept/lost=6718.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6718.0=actual_setup_level+swept_lost_low; 6778.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6718.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: Readers were well prepared. I warned last Thursday at 4pm: “Watch for the Failed Breakdown of Tuesday’s 6718 daily low.” On Friday ES flushed last Tuesday’s 6718 low by a few points, recovered, and ripped. This bounce took ES to backtest that 6778-82 zone which was resistance all day Friday.
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-09T05:08:00-04:00 minus 60 minutes through 2026-03-09T11:07:00-04:00 plus 90 minutes; trap_low=6671.5; reclaim=2026-03-09T11:07:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:206 `needs_bigger_crop`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: actual_recap
- Levels: setup=6612.0; swept/lost=6588.0, 6621.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6588.0=swept_lost_low; 6612.0=actual_setup_level; 6636.0=current_price_context; 6621.0=swept_lost_low; 6782.0=current_price_context
- Time mentions: 9:25PM, 9pm, 4pm
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Today, bulls would need to recover this to have any hope of upside, with bears controlling below. Bulls couldn’t recover it initially, and we went elevator down off the futures open last night due to more bearish weekly headlines, selling down to 6588. As always though, every elevator down sell in ES resolves in a squeeze, and last night was no different....
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T21:15:00-04:00 minus 60 minutes through 2026-03-08T22:34:00-04:00 plus 90 minutes; trap_low=6587.75; reclaim=2026-03-08T22:34:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:212 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=6739.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6718.0=current_price_context; 6739.0=actual_setup_level
- Time mentions: 9:50AM
- S/R coincidence: 6739.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I was still holding a 10% runner from the 9:50AM Failed Friday Breakdown of Tuesday’s 6718 low. I verified this at the close Friday, stating: “I am still holding my 10% long runner from the 9:50AM Failed Breakdown of Tuesday’s 6739 low.”
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-06T09:09:00-05:00 minus 60 minutes through 2026-03-06T09:12:00-05:00 plus 90 minutes; trap_low=6726.75; reclaim=2026-03-06T09:12:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:218 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6718.75; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6800.0=current_price_context; 6715.75=current_price_context; 6718.75=swept_lost_low; 6778.0=current_price_context
- Time mentions: 9:50AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw it Friday morning. ES went elevator down from 6800+ to 6715.75 by 9:50AM. This was a fast, classic elevator down sell. What comes next? The short squeeze. By selling to 6715.75, ES lost Tuesday’s 6718.75 daily low. Shortly after, it recovered (Failed Breakdown) and the parabolic rip began to 6778-82 where we peaked Friday afternoon.
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:220 `needs_bigger_crop`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: actual_recap
- Levels: setup=6612.0; swept/lost=6588.0, 6612.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6800.0
- Level roles: 6588.0=swept_lost_low; 6612.0=actual_setup_level+swept_lost_low; 6800.0=target_or_response
- Time mentions: 10pm, 6pm
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: From there? More weekend risk, and we went elevator down to 6588 by 10pm last night. Shortly after - a little after midnight - we got what always comes. A Failed Breakdown. Specifically right off the 6pm futures open Sunday ES sold to 6612 and bounced ~34 points. By 10pm, ES flushed that low down to 6588. A little after midnight, ES recovered that low (Fa...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T21:15:00-04:00 minus 60 minutes through 2026-03-08T22:34:00-04:00 plus 90 minutes; trap_low=6587.75; reclaim=2026-03-08T22:34:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:230 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=6718.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6782.0=current_price_context; 6718.0=actual_setup_level; 6778.0=current_price_context; 6800.0=current_price_context; 6813.0=current_price_context; 6829.0=current_price_context; 6850.0=current_price_context
- Time mentions: 9:50AM
- S/R coincidence: 6718.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case Monday: Very simple. 6782 was a big support level on Wednesday and on Thursday setting lows there both days. Today, we lost it, and in order for bulls to regain control, they must recover it. Its held as resistance all day today. The only small plus bulls have now is that 9:50AM today ES put in a big Failed Breakdown of Tuesday’s 6718 low, but t...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-09T05:08:00-04:00 minus 60 minutes through 2026-03-09T11:07:00-04:00 plus 90 minutes; trap_low=6671.5; reclaim=2026-03-09T11:07:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:232 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6588.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6588.0=swept_lost_low; 6782.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: As we will see, we sold off last evening down to 6588, big Failed Breakdown, then back up 6782 and beyond today.
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:246 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=current_price_context
- Time mentions: 12:10AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Sunday Evening and the 12:10AM 6612 Major Failed Breakdown
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:250 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6680.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The most immediate available Failed breakdown was of 6680. I wrote on Friday at 4pm: “If you are cautious though (like me) and its a fast sell, wait for 6680 to flush and recover to long. On November 24th ES set a massive low at 6680.”
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:258 `needs_bigger_crop`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: planned_setup
- Levels: setup=6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6588.0=current_price_context; 6612.0=actual_setup_level; 6647.0=current_price_context
- Time mentions: 10pm, 6pm
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: We continued lower after this into 6588 by 10pm. At this point, there was a fairly clear Failed Breakdown present. Specifically, at 6pm (right off the futures open) ES set a significant low at 6612. It was from this low ES bounced 34 points to 6647. This meets the criteria of a significant low and we would want to trade the flush and recovery.
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T22:43:00-04:00 minus 60 minutes through 2026-03-08T23:00:00-04:00 plus 90 minutes; trap_low=6603.0; reclaim=2026-03-08T23:00:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:274 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In this case, we had a clear example of the first type of acceptance shown in the above chart. Remember the first type of acceptance refers to when ES loses the significant low (6612), then back-tests the significant low (6612) from below, dips, then returns to it. This tell us price wants to be at the significant low, rather than wants to sell there. It ...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:292 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: What happens after a big support shelf fails? Firstly we sell hard (elevator down). Secondly, we see a Failed Breakdown (6612 Failed Breakdown last evening). Thirdly, we typically back-test the broken down shelf. If bulls can recover the broken down shelf, it is a significant technical win.
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T22:43:00-04:00 minus 60 minutes through 2026-03-08T23:00:00-04:00 plus 90 minutes; trap_low=6603.0; reclaim=2026-03-08T23:00:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:315 `needs_bigger_crop`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: planned_setup
- Levels: setup=6612.0; swept/lost=6732.0, 6700.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level; 6778.0=current_price_context; 6739.0=current_price_context; 6732.0=swept_lost_low; 6700.0=swept_lost_low; 6693.0=current_price_context; 6676.0=current_price_context; 6663.0=current_price_context; 6641.0=current_price_context
- Time mentions: 12:10AM, 1:45PM, 10am
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 6612 Failed Breakdown we saw at 12:10AM last evening and this long showed what Failed Breakdowns are all about. Last evening ES was going elevator down and collapsing. The world was ending on social media. I (and institutions, and readers of this newsletter) knew what was comi...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T22:43:00-04:00 minus 60 minutes through 2026-03-08T23:00:00-04:00 plus 90 minutes; trap_low=6603.0; reclaim=2026-03-08T23:00:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:319 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=6612.0; swept/lost=6612.0, 6588.0, 6732.0; recovered=6612.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level+swept_lost_low+recovered_level; 6588.0=swept_lost_low; 6778.0=current_price_context; 6738.0=current_price_context; 6732.0=swept_lost_low; 6700.0=current_price_context; 6832.0=current_price_context; 6850.0=current_price_context; 6918.0=current_price_context
- Time mentions: 6pm, 9:25PM
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case tomorrow: We had a massive squeeze today, driven by a classic Failed Breakdown last evening a little after midnight. ES plunged off the 6pm futures open down to 6612, bounced 34 points (setting a significant low). We then flushed that low into 6588 by 9:25PM and then recovered 6612 a little after midnight and went parabolic. Now, bulls need to d...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T21:15:00-04:00 minus 60 minutes through 2026-03-08T22:34:00-04:00 plus 90 minutes; trap_low=6587.75; reclaim=2026-03-08T22:34:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:321 `negative_control`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6738.0=current_price_context; 6726.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Possible short below 6738-42. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-05, 2026-03-06, 2026-03-09, 2026-03-10, 2026-03-11

### data\research\mancini\Longer Mancini Logs 2.txt:323 `data_only`

- Context: Bulls Bought The Dip With Force. Dead Cat Bounce, or Bottom? March 10th Plan | pub=2026-03-09 | plan=2026-03-10
- Source mode: context_recap
- Levels: setup=6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level; 6778.0=current_price_context; 6738.0=current_price_context; 6700.0=current_price_context; 6832.0=current_price_context; 6850.0=current_price_context; 6918.0=current_price_context
- Time mentions: none
- S/R coincidence: 6612.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for tomorrow: We had a massive rip today driven by a big Failed Breakdown at midnight last night of the 6612 Sunday opening low. After a 200 point leg up in a single session though, there is now nothing to do but wait for a retrace. 6778-82, 6738-42 are key retracement pivots with a trap of 6700 being the lowest bulls want to see in a strong bu...
- Nearest support context: line 313: Supports are: 6778-82 (major), 6774, 6764, 6758 (major), 6752, 6747, 6739-42 (major), 6732, 6727, 6721, 6716 (major), 6707, 6700 (major), 6693 (major), 6682, 6676 (major), 6668, 6663 (major), 6657, 6652 (major), 6645, 6639, 6632 (major), 6623 (major), 6617, 6609-12 (major), 6605, 6597 (major), 6589, 6583, 6577, 6573 (major), 6559, 6554, 6542 (major), 6536...
- Nearest resistance context: line 317: Resistances are: 6786, 6791, 6798 (major), 6804, 6813 (major), 6818, 6822, 6829-6832 (major), 6838, 6843, 6850-52 (major), 6861, 6865, 6873-76 (major), 6883, 6888, 6894, 6899, 6904 (major), 6904, 6913, 6918-21 (major), 6928, 6935, 6942 (major), 6953 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short e...
- Required crop: render ES 1m from 2026-03-08T22:43:00-04:00 minus 60 minutes through 2026-03-08T23:00:00-04:00 plus 90 minutes; trap_low=6603.0; reclaim=2026-03-08T23:00:00-04:00

### data\research\mancini\Longer Mancini Logs 2.txt:334 `needs_bigger_crop`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: actual_recap
- Levels: setup=6791.0; swept/lost=6768.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6782.0=current_price_context; 6791.0=actual_setup_level; 6768.0=swept_lost_low; 6913.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6791.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Like all gap downs/elevator down sells in ES though, this did not take long to see a Failed Breakdown and rip. I wrote on Friday at 4pm: “6782 is under there and instead of buying this, wait for it to hold and recover the 6791 February 17th major low.” Overnight we swept that 6791 low down to 6768, trapped bears, and ripped over 150 Points into yesterday’...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-03T08:41:00-05:00 minus 60 minutes through 2026-03-03T10:45:00-05:00 plus 90 minutes; trap_low=6768.0; reclaim=2026-03-03T10:45:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:336 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=6718.0, 6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=swept_lost_low; 6909.0=current_price_context; 6873.0=current_price_context; 6718.0=swept_lost_low
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The problem, however, is that - despite the big Failed Breakdown - ES remained stuck in the same range for 2 weeks. Heading into today, I mostly defined it as 6832 to 6909. The task today was for price to leave it one way or another. Price made its temporary decision overnight. I wrote yesterday: “Bear case tomorrow: 6832 has to fail, but in advance of th...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:338 `needs_bigger_crop`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: actual_recap
- Levels: setup=6742.0; swept/lost=6717.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6742.0=actual_setup_level; 6717.0=swept_lost_low
- Time mentions: 6:15AM, 11am
- S/R coincidence: 6742.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Like every elevator down sell though, it would resolve with a short squeeze. Around 6:15AM Es set a nice 58 point low at 6742. We swept it down to 6717 this morning as posted. By 11am we recovered it. I live-tweeted 6742 reclaim starts us higher, and we were +100 in no time back inside the old range.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:344 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6791.0=current_price_context; 6808.0=current_price_context
- Time mentions: 7:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Heading into today, I was still holding my 10% long runner from the 6791 major Failed Breakdown we saw yesterday (since it occurred overnight, I couldn’t enter until 6808 at 7:30AM Monday morning). I did a deep dive into the long in yesterday’s trade recap section and it was provided in advance. I verified this positioning at the close yesterday when I wr...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:350 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6811.0, 6809.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6850.0
- Level roles: 6811.0=swept_lost_low; 6809.0=swept_lost_low; 6850.0=target_or_response
- Time mentions: 6pm, 7:40PM, 9pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw precisely this to open up this week. Over the weekend Iran headlines hit and ES went gap down and elevator down off the open from 6880s down to 6811 6pm Sunday. We bounced 27 points from there. At 7:40PM Sunday ES then trapped below that 6811 opening low down to 6809, recovered it shortly after (Failed Breakdown) and ripped to 6850-55 by 9pm.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:352 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6768.0=current_price_context; 6791.0=current_price_context; 6912.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We then went elevator down 90 points to 6768 early Monday morning. From there? Another Failed Breakdown: We recovered the Feb 17th 6791 low shortly after then put in an absolutely monster Failed Breakdown that took ES up well over 100 points to 6912 high of day yesterday.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:354 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6718.0=current_price_context; 6742.0=current_price_context; 6800.0=current_price_context
- Time mentions: 6:15AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then today? Back elevator down again to 6718 this morning. In doing so, ES put in a large Failed Breakdown of a major 60 point low we set at 6:15AM at 6742. From there? Back up we go, ripping to 6800+.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:362 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6768.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6913.0
- Level roles: 6791.0=current_price_context; 6768.0=swept_lost_low; 6913.0=target_or_response; 6832.0=current_price_context; 6909.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was twofold. First, we saw a monster Failed Breakdown early Monday morning. We sold off below the February 17th 6791 low down to 6768, recovered it, and ripped to 6913 high of day. This gives bulls the ball because as always - after a big Failed Breakdown - bulls gain the initiative. Secondly though, ES was stuck insi...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:364 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=6768.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6909.0=current_price_context; 6832.0=current_price_context; 6850.0=current_price_context; 6791.0=current_price_context; 6768.0=swept_lost_low
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: We remain in a big range that is constantly morphing for the last couple weeks. Right now its mostly 6909 to 6832 with 6850 being a big pivot inside. The more important context here is that last night though, we saw a monster Failed Breakdown. We sold off below the February 17th 6791 low down to 6768, recovered it, and ripped. This giv...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:366 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6718.0=current_price_context; 6742.0=current_price_context; 6832.0=current_price_context
- Time mentions: 6:15AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bulls needed to hold this range. As we will see they didn’t. We lost it overnight, we sold over 100 points to 6718, put in a Failed Breakdown of a big 6:15AM low at 6742 shortly after, and ripped back towards 6832 into the afternoon.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:380 `needs_bigger_crop`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=6853.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6853.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 6853.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\008_accepted_non_acceptance_protocol_20260304_0912_6853.0.svg trap=6829.75 reclaim=2026-03-04T09:09:00-05:00 threshold_hold=1 visual=insufficient_visual_context overlap=7
- Blockers: no_source_stated_swept_low_below_setup, source_mode_planned_setup, visual_sanity_insufficient_visual_context
- Source: Monday Evening, The Start of the Sell, and the Possible 6853 Failed Breakdown
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...

### data\research\mancini\Longer Mancini Logs 2.txt:384 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6791.0, 6768.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6791.0=swept_lost_low; 6768.0=swept_lost_low
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Its been an absolutely incredible rip today and what makes it even more incredible is how predictable it was. I warned Friday (befre the war even broke out) that 1) If it does we’d see a gap down and elevator down then 2) We’d see a Failed Breakdown and squeeze today. We got both. Overnight we swept the 6791 February 17th low, sold to 6768, recovered 6791...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:388 `needs_bigger_crop`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=6853.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6853.0=actual_setup_level; 6912.0=current_price_context
- Time mentions: 4pm, 11:30AM
- S/R coincidence: 6853.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: I wrote yesterday at 4pm: “Again instead of buying this directly, there is a safer entry on the Failed Breakdown of the 6853 low we set at 11:30AM. It was from this low that we bounced into the ~6912 high of day and the trap and recovery here is actionable.”
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-02T02:49:00-05:00 minus 60 minutes through 2026-03-02T08:48:00-05:00 plus 90 minutes; trap_low=6790.75; reclaim=2026-03-02T08:48:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:390 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6853.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why is 6853 a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:392 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6912.0
- Level roles: 6853.0=current_price_context; 6912.0=target_or_response
- Time mentions: 11:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At ~6853 we had #2. At 11:30AM yesterday we set a huge low there, from which we rallied to 6912 high of day. This is a big low, the sort of which we’d want to see a flush and recovery of.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:403 `negative_control`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: negative_control
- Levels: setup=6853.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6853.0=actual_setup_level
- Time mentions: 9pm, 10:45PM
- S/R coincidence: 6853.0=coincides_partially
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Unfortunately, we never got a long trigger on this 6853 Failed Breakdown. ES spent between 9pm and 10:45PM simply backtesting 6853 from below, rejecting, and never recovered. It is worth noting though this was a fantastic example of the first type of acceptance shown above.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-02T02:49:00-05:00 minus 60 minutes through 2026-03-02T08:48:00-05:00 plus 90 minutes; trap_low=6790.75; reclaim=2026-03-02T08:48:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:409 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6768.0=current_price_context
- Time mentions: 6:40AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Tuesday Morning and the 6:40AM 6768 Monday Low Failed Breakdown
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:413 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6759.0=current_price_context; 6768.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Second, I noticed we got another quality Failed Breakdown overnight (and since we sold below by 6808ish entry from yesterday, my 10% lotto runner stopped out). I wrote yesterday at 4pm: “Nothing under there until 6759 but instead of buying it wait for it to hold and recover today’s 6768 daily low for a huge Failed Breakdown.”
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:417 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6768.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. Here at 6768 we had the prior days low at 6768 and this was a massive low set on Monday from which we rallied over 100 points. Its flush and recovery would be actionable.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:425 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6759.0=current_price_context; 6768.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote yesterday at 4pm: “Nothing under there until 6759 but instead of buying it wait for it to hold and recover today’s 6768 daily low for a huge Failed Breakdown.”
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:435 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=6742.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6742.0=actual_setup_level
- Time mentions: 11:03AM
- S/R coincidence: 6742.0=does_not_coincide
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, setup_level_does_not_coincide_with_sr_or_prose_context, source_mode_context_recap
- Source: The 11:03AM Failed Breakdown of the 6742 Overnight Low
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-03T09:18:00-05:00 minus 60 minutes through 2026-03-03T09:40:00-05:00 plus 90 minutes; trap_low=6731.0; reclaim=2026-03-03T09:40:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:437 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6742.0=current_price_context
- Time mentions: 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We continued back to the lows after this and the obvious trade here was the Failed Breakdown of the 6:20AM 6742 overnight low and this was a big low from which we rallied 50+ points.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:443 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6742.0=current_price_context
- Time mentions: 10:30AM, 10:40AM, 11am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When a sell algo is on we simply wait for a big Failed Breakdown. By 10:30AM, ES rallied to backtest ~6742 and dipped 10 points. By 10:40AM, we returned to 6742, dipped again 15 points, then came back by 11am. This is clear acceptance of the first type discussed above.
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:471 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=6743.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6743.0=actual_setup_level; 6808.0=current_price_context; 6795.0=current_price_context; 6904.0=current_price_context; 6848.0=current_price_context; 6876.0=current_price_context; 6925.0=current_price_context; 6943.0=current_price_context
- Time mentions: 11am, 6:15AM
- S/R coincidence: 6743.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: The bull case tomorrow is that this morning at 11am ES put in a big Failed Breakdown of the 6743 low we set at 6:15AM. This gives bulls the initiative again, but they need to sustain it. On a broader basis, ES is still stuck in the same range which is now mostly 6808/6795 support and 6904 resistance. 6808 was a big support Sunday eveni...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-03T09:18:00-05:00 minus 60 minutes through 2026-03-03T09:40:00-05:00 plus 90 minutes; trap_low=6731.0; reclaim=2026-03-03T09:40:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:473 `negative_control`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=current_price_context; 6795.0=current_price_context; 6789.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 6808/6795. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has m...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-27, 2026-03-02, 2026-03-03, 2026-03-04, 2026-03-05

### data\research\mancini\Longer Mancini Logs 2.txt:475 `data_only`

- Context: Another Big Dip In SPX That Was Again Bought. Was That The Bottom? March 4 Plan | pub=2026-03-03 | plan=2026-03-04
- Source mode: context_recap
- Levels: setup=6743.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6743.0=actual_setup_level; 6808.0=current_price_context; 6795.0=current_price_context; 6904.0=current_price_context; 6849.0=current_price_context; 6876.0=current_price_context
- Time mentions: 11am, 6:15AM
- S/R coincidence: 6743.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for tomorrow: At 11am ES put in a big Failed Breakdown of the 6743 low we set at 6:15AM. This gives bulls the initiative again, but they need to sustain it. On a broader basis, ES is still stuck in the same range which is now mostly 6808/6795 support and 6904 resistance. My general lean is ES can try up the range more. As long as 6808/6795 hold...
- Nearest support context: line 465: Supports are: 6822 (major), 6818, 6813, 6808 (major), 6802, 6795 (major), 6790, 6782 (major), 6776, 6770 (major), 6765, 6759 (major), 6752, 6747, 6743 (major), 6736, 6732 (major), 6727, 6720 (major), 6711, 6704-6700 (major), 6695, 6690 (major), 6685, 6680 (major), 6672, 6663 (major), 6657, 6652 (major), 6646, 6639 (major), 6635, 6631 (major), 6626, 6620 (...
- Nearest resistance context: line 469: Resistances are: 6828, 6832 (major), 6838, 6843, 6848-52 (major), 6862, 6866, 6876 (major), 6880, 6884 (major), 6894, 6899, 6904 (major), 6909, 6913 (major), 6918, 6925 (major), 6930, 6935-38 (major), 6943, 6953 (major), 6957, 6962, 6967 (major), 6973, 6985, 6991 (major), 6999, 7002, 7008 (major), 7017, 7022, 7027 (major). As readers know I don’t short ES...
- Required crop: render ES 1m from 2026-03-03T09:18:00-05:00 minus 60 minutes through 2026-03-03T09:40:00-05:00 plus 90 minutes; trap_low=6731.0; reclaim=2026-03-03T09:40:00-05:00

### data\research\mancini\Longer Mancini Logs 2.txt:484 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: actual_recap
- Levels: setup=6808.0; swept/lost=6791.0, 6808.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6791.0=swept_lost_low; 6808.0=actual_setup_level+swept_lost_low; 6795.0=current_price_context; 6860.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw precisely this on Tuesday In the morning we went elevator down 70+ points down to 6791. In doing so, ES lost Friday’s daily low at 6808. Shortly after we recovered, and were off. I wrote on Friday at 4pm: “If this is the case, the obvious entry is to wait for 6795 to defend (doesn’t need to be exact) then recover today’s 6808 daily low.” Yesterday ...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:486 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: planned_setup
- Levels: setup=none; swept/lost=6791.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6876.0
- Level roles: 6808.0=current_price_context; 6791.0=swept_lost_low; 6843.0=current_price_context; 6876.0=target_or_response; 6893.0=current_price_context; 6923.0=current_price_context; 6954.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The task for yesterday would be for bulls to keep it going. I wrote Tuesday at 4pm: “In summary for tomorrow: ES put in a big Failed Breakdown today by trapping under Friday’s 6808 low down to 6791, and recovering 6808. Bulls need to keep it going. My general lean is bulls need to hold 6843 ideally. From there next leg targets 6876, 6893, 6923-26, then 69...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:488 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: actual_recap
- Levels: setup=6808.0; swept/lost=6791.0, 6808.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=actual_setup_level+swept_lost_low; 6791.0=swept_lost_low; 6877.0=current_price_context; 6904.0=current_price_context; 6925.0=current_price_context; 6939.0=current_price_context; 6954.0=current_price_context; 6849.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: After a large rally like that, bulls would need to survive any retracements, and digest the move. My lean was ES could. I wrote yesterday at 4pm: “In summary for tomorrow: Yesterday we had a monster Failed Breakdown where ES flushed the Friday 6808 low, sold down to 6791, recovered, and ripped 130 points. Now, bulls want to keep the retracement healthy. M...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:494 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0, 6854.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=actual_setup_level; 6854.0=actual_setup_level
- Time mentions: 10:45AM, 4pm, 7:10PM
- S/R coincidence: 6808.0=coincides_partially; 6854.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 10:45AM 6808 monster Failed Breakdown we had Monday, discussed Monday in great detail and provided on Friday at 4pm. I confirmed this at the close yesterday when I wrote: “I am still holding my 10% long runner from the 10:45AM monster 6808 Failed Breakdown we had yesterday. My most recent...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:502 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: data_context
- Levels: setup=none; swept/lost=6822.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=current_price_context; 6822.0=swept_lost_low; 6893.0=current_price_context
- Time mentions: 1:30AM, 8:15AM, 9:45AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: By selling to 6808, ES lost a massive shelf of lows at 6822-24 we set between 1:30AM and 8:15AM Friday. We recovered it around 9:45AM Friday morning, and the short squeeze began to ~6893 high of day.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:504 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0; swept/lost=6791.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6860.0
- Level roles: 6860.0=target_or_response; 6791.0=swept_lost_low; 6808.0=actual_setup_level; 6923.0=current_price_context
- Time mentions: 9:40AM, 10:30AM, 10am
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Tuesday morning, we repeated the cycle. We rallied to 6860 by 9:40AM then went elevator down to 6791 by 10:30AM. Shortly after, ES put in a monster Failed Breakdown of Friday’s 6808 low, and back up the levels we went to 6923 by 10am yesterday from which we topped out into today.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:512 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: actual_recap
- Levels: setup=6808.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=actual_setup_level; 6849.0=current_price_context; 6954.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: 2) The basic theme today was simple. On Monday (as discussed above) ES put in a monster Failed Breakdown of the Friday 6808 daily low, and we were off to the races. As always after a big rally the task for bulls is to defend key supports/backtest points on the way down as there is always a point where a retracement goes from healthy to non-healthy (riskin...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:514 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0; swept/lost=6791.0, 6808.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6925.0
- Level roles: 6808.0=actual_setup_level+swept_lost_low; 6791.0=swept_lost_low; 6849.0=current_price_context; 6877.0=current_price_context; 6904.0=current_price_context; 6925.0=target_or_response; 6939.0=current_price_context; 6954.0=current_price_context
- Time mentions: none
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case tomorrow: Fairly straight forward. Yesterday we had a monster Failed Breakdown where ES flushed the Friday 6808 low, sold down to 6791, recovered, and ripped 130 points. Now, bulls want to keep the retracement healthy. Generally this means holding 6849 lowest. In a strong bull case though, ES won’t even get down there. Here, ES will hold 6877 (o...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:530 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6872.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=actual_setup_level
- Time mentions: 6:20AM
- S/R coincidence: 6872.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Wednesday Evening and the Thursday 6:20AM 6872 Failed Breakdown:
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:538 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: planned_setup
- Levels: setup=6872.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=actual_setup_level; 6877.0=current_price_context
- Time mentions: 3:15PM, 4pm
- S/R coincidence: 6872.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first obvious Failed Breakdown was the Failed Breakdown of the 6872 3:15PM low (assuming we even got it as a trigger). I provided this setup yesterday at 4pm when I wrote: “The first proper support down is 6877. We held this late day today at 3:15PM more or less. It is well tested now. While one could try giving it another bid, remember my core rule: ...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:540 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why 6872? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:542 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=current_price_context
- Time mentions: 3:15PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At ~6872 we had #2. At 3:15PM on Wednesday, ES set a huge low there from which we rallied 30 points. This is a clear, V-shaped low of the sort we’d want to see a flush and recovery of.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:544 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6872.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6910.0=current_price_context; 6866.0=current_price_context; 6872.0=actual_setup_level
- Time mentions: 2:30AM, 3:30AM, 5:30AM, 3:15PM
- S/R coincidence: 6872.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Unfortunately, ES was too strong initially to get this and we drifted higher to 6910 by 2:30AM. Around 3:30AM, ES finally got an elevator down sell getting to 6866 by 5:30AM. This meant we flushed that 3:15PM 6872 low, setting up a Failed Breakdown.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:559 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6888.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This Failed Breakdown only saw a level to level move to ~6888 1st up.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:563 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: planned_setup
- Levels: setup=6808.0, 6772.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=actual_setup_level; 6772.0=actual_setup_level
- Time mentions: 10:45AM
- S/R coincidence: 6808.0=coincides_partially; 6772.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: As traders, we don’t think about how far any will go, nor do we engage in prediction. We take planned high quality Failed Breakdowns, manage it level to level, leave a runner. Price will do what it wants and over 100’s of Failed Breakdowns, you will see the full gamut of returns. On Tuesday morning at 10:45AM we had a 120+ point Failed Breakdown of the 68...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:565 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6861.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6861.0=actual_setup_level
- Time mentions: 9:42AM
- S/R coincidence: 6861.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Thursday Morning and the 9:42AM 6861 Failed Breakdown
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:569 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6857.0=current_price_context; 6856.0=current_price_context; 6861.0=current_price_context
- Time mentions: 9:36AM, 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: At 9:36AM, ES got a fast dip to 6857 support, activating the next planned trade down. I wrote yesterday at 4pm: “Wait for that to flush and recover. Next support down is 6856. Same drill here, if we are knifing fast, instead of just buying it, wait for it to defend then recover 6861. Why 6861? At 930AM today, we set a huge low at 6861 from which we rallie...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:571 `needs_bigger_crop`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: actual_recap
- Levels: setup=6861.0; swept/lost=none; recovered=6861.0; non_acceptance=6866.0; invalidation=none; target/response=none
- Level roles: 6857.0=current_price_context; 6861.0=actual_setup_level+recovered_level; 6866.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: 6861.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: By selling to 6857, ES swept that 6861 low, from which ES rallied 64 points. As written, this was a very high quality Failed Breakdown. We essentially instantly recovered 6861 here, so the only option was to use the non-acceptance protocol. Remember the non-acceptance protocol activates whenever price recovers the significant low (6861) by 5 points (6866)...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:581 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6857.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6857.0=actual_setup_level
- Time mentions: 1:45PM
- S/R coincidence: 6857.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 1:45PM Double Dip Failed Breakdown of 6857
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:585 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6857.0=current_price_context
- Time mentions: 9:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: While one could have bid this, there was another Failed Breakdown here of the 6857 9:30AM morning low for those still trading. This is what I call a double dip Failed Breakdown. These are very common and they look like this:
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:590 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6961.0=current_price_context; 6893.0=current_price_context; 6857.0=current_price_context
- Time mentions: 9:42AM, 9:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: They occur when price puts in one Failed Breakdown (the 9:42AM Failed Breakdown of yesterday’s 9:30AM 6961 low) and rallies nicely as we did to 6893. Then, ES loses the low of that original Failed Breakdown (which was 6857 this morning), recovers it, and rallies again. Now and then, we even see triple or quadruple dip Failed Breakdowns.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:592 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0, 6857.0; swept/lost=none; recovered=6857.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6857.0=actual_setup_level+recovered_level; 6808.0=actual_setup_level
- Time mentions: 1:45PM
- S/R coincidence: 6808.0=coincides_partially; 6857.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: We recovered 6857 by 1:45PM and one could’ve longed via the non-acceptance protocol or first type of acceptance. I didn’t take this one and opted to just hold my runner from Tuesday’s 6808 Failed Breakdown. I had a very low cost basis here.
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:616 `negative_control`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: negative_control
- Levels: setup=6848.0, 6791.0, 6808.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6808.0=actual_setup_level; 6867.0=current_price_context; 6845.0=current_price_context; 6884.0=current_price_context; 6861.0=current_price_context; 6866.0=current_price_context; 6848.0=actual_setup_level; 6838.0=current_price_context; 6822.0=current_price_context; 6813.0=current_price_context; 6791.0=actual_setup_level; 6782.0=current_price_context; 6772.0=current_price_context; 6758.0=current_price_context
- Time mentions: 10:45AM, 3:45PM, 3:30PM, 5:45AM, 9:30AM
- S/R coincidence: 6848.0=coincides_partially; 6791.0=coincides_partially; 6808.0=coincides_partially
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 10:45AM monster 6808 Failed Breakdown we had Tuesday. My most recent entry was the 6867-70 Level Reclaim long we had at 3:45PM today, which was managed level to level and tweeted out live at 3:30PM (shown above). I will warn tomorrow is OPEX day. While not always the case, OPE...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:620 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0; swept/lost=6791.0, 6808.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6884.0, 6898.0
- Level roles: 6808.0=actual_setup_level+swept_lost_low; 6791.0=swept_lost_low; 6845.0=current_price_context; 6884.0=target_or_response; 6867.0=current_price_context; 6898.0=target_or_response; 6913.0=current_price_context; 6925.0=current_price_context; 6954.0=current_price_context
- Time mentions: none
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case tomorrow: On Tuesday we had a monster Failed Breakdown where ES flushed the Friday 6808 low, sold down to 6791, recovered, and ripped 130 points. Today we spent it digesting that move and ES is largely rangebound with the range being 6845-6884 for the most part, with 6867-70 being a big magnet in the middle. The bull case tomorrow is that ES can...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:622 `negative_control`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6845.0=current_price_context; 6835.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 6845. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\Longer Mancini Logs 2.txt:624 `data_only`

- Context: SPX Is Again Coiled Tightly. Move Incoming. What Way? Feb 20th Plan | pub=2026-02-19 | plan=2026-02-20
- Source mode: context_recap
- Levels: setup=6808.0; swept/lost=6791.0, 6808.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6884.0
- Level roles: 6808.0=actual_setup_level+swept_lost_low; 6791.0=swept_lost_low; 6845.0=current_price_context; 6884.0=target_or_response; 6898.0=current_price_context; 6913.0=current_price_context; 6925.0=current_price_context; 6954.0=current_price_context
- Time mentions: none
- S/R coincidence: 6808.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: In summary for tomorrow: On Tuesday we had a monster Failed Breakdown where ES flushed the Friday 6808 low, sold down to 6791, recovered, and ripped 130 points. Today we spent it digesting that move and ES is largely rangebound with the range being 6845-6884 for the most part. My general lean is to defer to the trend. Bulls want to fill out this range (or...
- Nearest support context: line 614: Supports are: 6864, 6861 (major), 6855, 6851, 6845 (major), 6838, 6832, 6822 (major), 6813, 6802 (major), 6795, 6790 (major), 6782, 6777, 6772 (major), 6764, 6758 (major), 6752, 6743, 6736, 6732 (major), 6727 (major), 6716, 6710, 6704 (major), 6697 (major), 6689, 6681 (major), 6672, 6664 (major), 6657, 6652 (major), 6646, 6639, 6631 (major), 6619, 6610 (m...
- Nearest resistance context: line 618: Resistances are: 6867-70 (major), 6876, 6880, 6884-88 (major), 6893, 6898 (major), 6907, 6913 (major), 6918, 6925-30 (major), 6935, 6944, 6950-53 (major), 6957, 6965, 6970-73 (major), 6981, 6986, 6993 (major), 6996, 7002 (major), 7007, 7011, 7017, 7022 (major), 7028, 7036 (major), 7042, 7055 (major), 7065 (major), 7080, 7088, 7096 (major), 7105, 7115, 712...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-19

### data\research\mancini\The Longer Mancini Logs.txt:17 `needs_bigger_crop`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=7390.0
- Level roles: 7199.0=current_price_context; 7213.0=actual_setup_level+recovered_level; 7390.0=target_or_response
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: Why 7199 and where was the Failed Breakdown here? 7199 backtested the week long consolidation we broke out last Thursday, but shortly after - around 12:20PM Monday- ES recovered a major low set at 6:20AM Monday at 7213 and rallied. This was a clear Failed Breakdown: We set a big low at 7213, swept it, recovered, and ripped to ~7390’s by yesterday’s close.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:55 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7137.0, 7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level
- Time mentions: 4pm, 4:20PM, 12:20PM
- S/R coincidence: 7137.0=does_not_coincide; 7213.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown discussed above.”
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:63 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: data_context
- Levels: setup=none; swept/lost=7355.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7345.0=current_price_context; 7355.0=swept_lost_low
- Time mentions: 1:30PM, 1pm, 1:40PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then today? We finally went elevator down again into 7345 by 1:30PM. In doing so, ES flushed a big low at 7355 from 1pm Wednesday. By 1:40PM, we recovered it, and popped.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:71 `needs_bigger_crop`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=7300.0
- Level roles: 7199.0=current_price_context; 7300.0=target_or_response; 7213.0=actual_setup_level+recovered_level
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: 2) The basic theme heading into today was that last Thursday, ES broke out of a week long range with resistance roughly at 7199 and we rallied to 7300 on Friday. Monday, we backtested this break out and defended a little after noon. Shortly after this back-test - around 12:20PM Monday - ES put in a Failed Breakdown where we recovered a major low set at at...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:73 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7332.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7400.0
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7345.0=current_price_context; 7332.0=actual_setup_level; 7400.0=target_or_response; 7426.0=current_price_context; 7451.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7332.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: Bulls have very simply won in the most comprehensive manner possible and there is little to write about here in this parabolic scenario. What caused this latest parabolic rip? Simple charting and we have been involved every step of the way. Last Thursday ES broke out of a week long range that roughly had resistance at 7199. Monday, we ...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:87 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7355.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7355.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7355.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Wednesday Evening and the un-triggered 7355 Failed Breakdown
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:89 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Yesterday, we closed near the highs after a monster all day rally, driven (like all rallies are) by a big Failed Breakdown we had on Monday at 12:20PM of the 6:20AM 7213 Monday low.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:95 `needs_bigger_crop`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: planned_setup
- Levels: setup=7355.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7355.0=actual_setup_level; 7345.0=current_price_context
- Time mentions: 4pm, 12:30PM
- S/R coincidence: 7355.0=coincides_cleanly
- Chart/window: artifacts\research\mancini-real-packet-gallery\170_accepted_non_acceptance_protocol_20260507_1237_7355.0.svg trap=7345.75 reclaim=2026-05-07T12:28:00-04:00 threshold_hold=6 visual=dangerous_demote_for_training visual_reasons=quant_agent_demote_late_reclaim_rolls_back_through_level overlap=12
- Blockers: no_source_stated_swept_low_below_setup, source_mode_planned_setup, visual_sanity_dangerous_demote_for_training
- Source: The first low quality possible entry was down was a Failed Breakdown of 7355. I wrote yesterday at 4pm: “7345 is below there. This is also a shallow support. If its a slow grind into the zone one can buy it, but if we are free falling, don’t knife catch. A much safer entry is to wait for 7345 to defend, then recover 7355 to get long. Why 7355? At 12:30PM ...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:97 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7355.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7355 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:108 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7360.0; invalidation=none; target/response=none
- Level roles: 7355.0=current_price_context; 7360.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7355) by 5 points (7360) and holds at or above 7360 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:123 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: You can see here how powerful the combination of runners and Failed Breakdowns are. Failed Breakdown of 7213 Monday, then runners did the rest. The beauty of runners is that you don’t need to know what move will go 150 points. As traders - we don’t predict.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:131 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7355.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7355.0=actual_setup_level
- Time mentions: 1:38PM
- S/R coincidence: 7355.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The noon “elevator down” sell into the 1:38PM 7355 Failed Breakdown Scalp
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:133 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=7355.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7400.0=current_price_context; 7355.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7355.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Around noon, ES finally got an injection of volatility and we went elevator down from 7400+ downward. The nearest quality entry was the 7355 Failed Breakdown, discussed above.
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:139 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: actual_recap
- Levels: setup=7355.0; swept/lost=7345.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7355.0=actual_setup_level; 7345.0=swept_lost_low
- Time mentions: 1:25PM, 12:30PM
- S/R coincidence: 7355.0=coincides_cleanly
- Chart/window: artifacts\research\mancini-real-packet-gallery\170_accepted_non_acceptance_protocol_20260507_1237_7355.0.svg trap=7345.75 reclaim=2026-05-07T12:28:00-04:00 threshold_hold=6 visual=dangerous_demote_for_training visual_reasons=quant_agent_demote_late_reclaim_rolls_back_through_level overlap=12
- Blockers: visual_sanity_dangerous_demote_for_training
- Source: At 1:25PM, ES finally got that 7355 Failed Breakdown. We swept it down to 7345 and recovered shortly after. As I wrote yesterday: “7345 is below there. This is also a shallow support. If its a slow grind into the zone one can buy it, but if we are free falling, don’t knife catch. A much safer entry is to wait for 7345 to defend, then recover 7355 to get l...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:158 `needs_bigger_crop`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: planned_setup
- Levels: setup=7327.0, 7306.0, 7213.0, 7255.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level; 7255.0=actual_setup_level; 7402.0=current_price_context; 7340.0=current_price_context; 7327.0=actual_setup_level; 7311.0=current_price_context; 7306.0=actual_setup_level; 7279.0=current_price_context; 7283.0=current_price_context; 7257.0=current_price_context
- Time mentions: 12:20PM, 1:20PM, 2:40PM
- S/R coincidence: 7327.0=coincides_cleanly; 7306.0=coincides_cleanly; 7213.0=coincides_partially; 7255.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 12:20PM 7213 Failed breakdown on Monday. My most recent entry was the 7255 Failed Breakdown at noon today. Today we finally got some red and as a result we saw setups for the first time since Monday. I said this yesterday, and it was applicable today: “Readers know I always sa...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:162 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7345.0=current_price_context; 7311.0=current_price_context; 7393.0=current_price_context; 7402.0=current_price_context; 7345.75=current_price_context; 7383.0=current_price_context; 7418.0=current_price_context; 7430.0=current_price_context; 7369.0=current_price_context
- Time mentions: 12:20PM, 6:20AM, 2:45PM, 1:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: I will repeat from yesterday, “Bulls have very simply won in the most comprehensive manner possible and there is little to write about here in this parabolic scenario. What caused this latest parabolic rip? Simple charting and we have been involved every step of the way. Last Thursday ES broke out of a week long range that roughly had ...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:164 `negative_control`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7345.0=current_price_context; 7337.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: We could start a micro retracement if 7345 fails. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done ...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:166 `data_only`

- Context: SPX Takes A Small Breather Today. Is More Pullback Ahead? May 8 Plan | pub=2026-05-07 | plan=2026-05-08
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7402.0=current_price_context; 7345.0=current_price_context; 7311.0=current_price_context; 7383.0=current_price_context; 7393.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: Last Thursday ES broke out of a week long range that roughly had resistance at 7199. Monday, we backtested it and defended. Then Monday at 12:20PM - shortly after this backtest - ES put in a monster Failed Breakdown of Monday’s 6:20AM 7213 major low, and we ripped non-stop since. Today, ES finally took a small breather. My general...
- Nearest support context: line 156: Supports are: 7355, 7348, 7345-40 (major), 7338, 7332, 7327 (major), 7320, 7311 (major), 7306, 7301, 7291, 7284, 7279 (major), 7274, 7263, 7257 (major), 7247, 7241, 7238 (major), 7228, 7220 (major), 7212 (major), 7207, 7200 (major), 7193, 7188 (major), 7181, 7173 (major), 7165, 7161 (major), 7153, 7147 (major), 7142, 7135 (major), 7128, 7121, 7111 (major)...
- Nearest resistance context: line 160: Resistances are: 7360, 7369 (major), 7375, 7383 (major), 7389, 7393 (major), 7400, 7402 (major), 7413, 7418 (major), 7421, 7430 (major), 7437, 7442 (major), 7454 (major), 7461, 7469, 7477 (major), 7487, 7493 (major), 7500 (major), 7504, 7516 (major), 7522, 7533 (major), 7537, 7543 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:189 `needs_bigger_crop`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=7300.0
- Level roles: 7199.0=current_price_context; 7213.0=actual_setup_level+recovered_level; 7300.0=target_or_response
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: Why 7199 and where was the Failed Breakdown here? 7199 backtested the week long consolidation we broke out last Thursday, but shortly after - around 12:20PM Monday- ES recovered a major low set at 6:20AM Monday at 7213 and rallied. This was a clear Failed Breakdown: We set a big low at 7213, swept it, recovered, and ripped to ~7300 by Tuesday.
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:227 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=7137.0, 7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level
- Time mentions: 4pm, 4:20PM, 12:20PM
- S/R coincidence: 7137.0=does_not_coincide; 7213.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown on Monday”
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:241 `needs_bigger_crop`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=7300.0
- Level roles: 7199.0=current_price_context; 7300.0=target_or_response; 7213.0=actual_setup_level+recovered_level
- Time mentions: 12:20PM, 6:20AM, 4pm
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: 2) The basic theme heading into today was that on Thursday, ES broke out of a week long range with resistance roughly at 7199 and we rallied to 7300 on Friday. Monday, we backtested this break out and defended a little after noon. Shortly after this back-test - around 12:20PM Monday - ES put in a Failed Breakdown where we recovered a major low set at at 6...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:243 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7313.0
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7212.0=current_price_context; 7300.0=current_price_context; 7248.0=current_price_context; 7313.0=target_or_response; 7336.0=current_price_context; 7366.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Last Thursday ES broke out of a week long range that roughly had resistance at 7199-94. Yesterday, we backtested it and defended. Then yesterday (Monday) at 12:20PM - shortly after this backtest - ES put in a monster Failed Breakdown of Monday’s 6:20AM 7213 major low, and we ripped all day today. ES is clearly forming a big multi-day c...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:261 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Yesterday, we closed near the highs after a monster all day rally, driven (like all rallies are) by a big Failed Breakdown we had on Monday at 12:20PM of the 6:20AM 7213 Monday low.
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:265 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=7137.0, 7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level
- Time mentions: 4:20PM, 12:20PM, 6:20AM
- S/R coincidence: 7137.0=does_not_coincide; 7213.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown yesterday, discussed above and provided in advance. We had an incredible rip today and unfortunately this means we returned to the same low volatility grind up. I very frequently talk about how even though I on...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:267 `needs_bigger_crop`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: planned_setup
- Levels: setup=7279.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7279.0=actual_setup_level
- Time mentions: 4pm, 11:30AM, 1:10PM
- S/R coincidence: 7279.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first low quality possible entry was down was a Failed Breakdown of 7279. I wrote yesterday at 4pm: “7279 is below there. Between 11:30AM and 1:10PM today, ES set a nice multi-touch shelf of lows at 7279. This is a 5-6 touch shelf. The flush and recovery of this is actionable as a Failed Breakdown, but given its position in the trend leg from yesterda...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:269 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7279.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7279 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:280 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7284.0; invalidation=none; target/response=none
- Level roles: 7279.0=current_price_context; 7284.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7279) by 5 points (7284) and holds at or above 7284 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:290 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: You can see here how powerful the combination of runners and Failed Breakdowns are. Failed Breakdown of 7213 Monday, then runners did the rest. The beauty of runners is that you don’t need to know what move will go 150 points. As traders - we don’t predict.
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:319 `needs_bigger_crop`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: planned_setup
- Levels: setup=7137.0, 7213.0; swept/lost=7327.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level; 7369.0=current_price_context; 7345.0=current_price_context; 7355.0=current_price_context; 7332.0=current_price_context; 7327.0=swept_lost_low; 7311.0=current_price_context; 7284.0=current_price_context
- Time mentions: 4:20PM, 12:20PM, 12:30PM, 8am
- S/R coincidence: 7137.0=coincides_partially; 7213.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown discussed above. It is starting to sound repetitive now but this is the case in parabolic markets - yet again there is not much to do up here after ripping all day. Readers know...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:323 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=7332.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7400.0
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7345.0=current_price_context; 7332.0=actual_setup_level; 7400.0=target_or_response; 7426.0=current_price_context; 7451.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7332.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: Bulls have very simply won in the most comprehensive manner possible and there is little to write about here in this parabolic scenario. What caused this latest parabolic rip? Simple charting and we have been involved every step of the way. Last Thursday ES broke out of a week long range that roughly had resistance at 7199. Monday, we ...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:325 `negative_control`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7332.0=current_price_context; 7322.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: We could start a micro retracement if 7332 fails. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done ...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:327 `data_only`

- Context: SPX Has Gone Fully Parabolic. Is There Another Entry? May 7 Plan | pub=2026-05-06 | plan=2026-05-07
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7332.0=current_price_context; 7400.0=current_price_context; 7426.0=current_price_context; 7451.0=current_price_context; 7345.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: ES is parabolic and there is nothing to do - longs are still working from Monday’s setup. Last Thursday ES broke out of a week long range that roughly had resistance at 7199. Monday, we backtested it and defended. Then Monday at 12:20PM - shortly after this backtest - ES put in a monster Failed Breakdown of Monday’s 6:20AM 7213 ma...
- Nearest support context: line 317: Supports are: 7369 (major), 7356, 7345 (major), 7338, 7332(major), 7326, 7311 (major), 7309, 7300 (major), 7297, 7295 (major), 7289, 7284 (major), 7279, 7273, 7268 (major), 7262, 7257 (major), 7248 (major), 7242, 7233 (major), 7225, 7218 (major), 7214, 7209 (major), 7204, 7200 (major), 7194, 7186 (major), 7181, 7173 (major), 7165 (major), 7159, 7147 (majo...
- Nearest resistance context: line 321: Resistances are: 7378, 7387 (major), 7391, 7400 (major), 7411, 7418, 7426 (major), 7430, 7435 (major), 7443, 7451 (major), 7454, 7458, 7464 (major), 7474, 7484 (major), 7490, 7497 (major), 7500, 7515 (major), 7528, 7538 (major), 7545, 7553 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries her...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\The Longer Mancini Logs.txt:346 `needs_bigger_crop`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=actual_setup_level+recovered_level
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: 7213.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: Why 7199 and where was the Failed Breakdown here? 7199 backtested the week long consolidation we broke out last Thursday, but shortly after - around 12:20PM yesterday - ES recovered a major low set at 6:20AM yesterday at 7213 and rallied. The task today was for bulls to push more here.
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:348 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=7199.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level; 7199.0=swept_lost_low; 7240.0=current_price_context; 7268.0=current_price_context; 7194.0=current_price_context; 7177.0=current_price_context
- Time mentions: 11am
- S/R coincidence: 7213.0=coincides_cleanly
- Chart/window: artifacts\research\mancini-real-packet-gallery\142_accepted_non_acceptance_protocol_20260430_1233_7213.0.svg trap=7205.5 reclaim=2026-04-30T12:30:00-04:00 threshold_hold=1 visual=dangerous_demote_for_training visual_reasons=source_text_is_target_or_context_not_failed_breakdown_proof overlap=7
- Blockers: chart_trap_low_7205.5_mismatch_stated_sweep_7199.0, visual_sanity_dangerous_demote_for_training
- Source: I wrote at the close yesterday: “A little after noon today - ES put in a Failed Breakdown where we lost a major 620AM 7213 low down to 7199 as stated, recovered, and ripped. My general lean is we can push off this to 7240, perhaps dip, then head to 7268/77. This may act as a resistance of a new broad range now between 7194-7177 that we can play for a few ...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...

### data\research\mancini\The Longer Mancini Logs.txt:384 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=7137.0, 7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level
- Time mentions: 4pm, 4:20PM, 12:20PM
- S/R coincidence: 7137.0=does_not_coincide; 7213.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown discussed above.”
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:402 `needs_bigger_crop`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: actual_recap
- Levels: setup=7213.0; swept/lost=none; recovered=7213.0; non_acceptance=none; invalidation=none; target/response=7300.0
- Level roles: 7199.0=current_price_context; 7300.0=target_or_response; 7213.0=actual_setup_level+recovered_level
- Time mentions: 12:20PM, 6:20AM, 4pm
- S/R coincidence: 7213.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: 2) The basic theme heading into today was that on Thursday, ES broke out of a week long range with resistance roughly at 7199 and we rallied to 7300 on Friday. Yesterday, we backtested this break out and defended a little after noon. Shortly after this back-test - around 12:20PM yesterday - ES put in a Failed Breakdown where we recovered a major low set a...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:404 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=actual_setup_level; 7240.0=current_price_context; 7268.0=current_price_context; 7194.0=current_price_context; 7177.0=current_price_context
- Time mentions: none
- S/R coincidence: 7213.0=coincides_cleanly
- Chart/window: artifacts\research\mancini-real-packet-gallery\142_accepted_non_acceptance_protocol_20260430_1233_7213.0.svg trap=7205.5 reclaim=2026-04-30T12:30:00-04:00 threshold_hold=1 visual=dangerous_demote_for_training visual_reasons=source_text_is_target_or_context_not_failed_breakdown_proof overlap=7
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap, visual_sanity_dangerous_demote_for_training
- Source: Bull case tomorrow: Last Thursday ES broke out of a week long range that roughly had resistance at 7199-94. Today, we backtested it and defended. In a very strong bull case, ES will continue to defend this backtest (perhaps a quick trap of today’s 7199 low at best). From there, ES will begin to build out a new range. In a really strong bull case though, E...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...

### data\research\mancini\The Longer Mancini Logs.txt:420 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=7220.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7220.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7220.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Monday Evening and the untriggered 7220 Failed Breakdown
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:422 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=current_price_context
- Time mentions: 6:20AM, 12:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: As discussed above, we had a high quality Failed Breakdown of the 6:20AM Monday 7213 low at 12:20PM yesterday, so the momentum from this continued into the close yesterday.
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:424 `needs_bigger_crop`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: planned_setup
- Levels: setup=7220.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7220.0=actual_setup_level; 7217.0=current_price_context
- Time mentions: 4pm, 2:40PM
- S/R coincidence: 7220.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first low quality possible entry was down was a Failed Breakdown of 7220. I wrote yesterday at 4pm: “As of writing, 7220 is 1st support down. This support is in the middle of nowhere technically and is low quality. I would not buy it directly, but we did set a small low around there at 7217 at 2:40PM. If we can flush this low and recover, it would be ...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:426 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7220.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7220 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:437 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7225.0; invalidation=none; target/response=none
- Level roles: 7220.0=current_price_context; 7225.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7220) by 5 points (7225) and holds at or above 7225 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:439 `negative_control`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: negative_control
- Levels: setup=7213.0; swept/lost=7199.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level; 7199.0=swept_lost_low; 7240.0=current_price_context; 7268.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 7213.0=coincides_cleanly
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Unfortunately we never got this and we simply continued grinding up into the evening, and runners paid on this. I wrote yesterday at 4pm: “Today, we backtested it and defended. Shortly after this back-test - a little after noon today - ES put in a Failed Breakdown where we lost a major 620AM 7213 low down to 7199 as stated, recovered, and ripped. My gener...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:466 `needs_bigger_crop`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: planned_setup
- Levels: setup=7213.0, 7199.0, 7137.0; swept/lost=7213.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level+swept_lost_low; 7289.0=current_price_context; 7279.0=current_price_context; 7258.0=current_price_context; 7248.0=current_price_context; 7199.0=actual_setup_level
- Time mentions: 4:20PM, 12:20PM, 6:20AM, 11:30AM, 1:10PM, 7:10AM
- S/R coincidence: 7213.0=coincides_cleanly; 7199.0=coincides_partially; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown yesterday, discussed above and provided in advance. We had an incredible rip today and unfortunately this means we returned to the same low volatility grind up. I very frequentl...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:470 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7313.0
- Level roles: 7199.0=current_price_context; 7213.0=current_price_context; 7212.0=current_price_context; 7300.0=current_price_context; 7248.0=current_price_context; 7313.0=target_or_response; 7336.0=current_price_context; 7366.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Last Thursday ES broke out of a week long range that roughly had resistance at 7199-94. Yesterday, we backtested it and defended. Then yesterday (Monday) at 12:20PM - shortly after this backtest - ES put in a monster Failed Breakdown of Monday’s 6:20AM 7213 major low, and we ripped all day today. ES is clearly forming a big multi-day c...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:472 `negative_control`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=current_price_context; 7241.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7248. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:474 `data_only`

- Context: [Re-Send] Bulls Bought The SPX Dip Yesterday. Will There Be Another This Week? May 6th Plan | pub=2026-05-05 | plan=2026-05-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7313.0
- Level roles: 7213.0=current_price_context; 7212.0=current_price_context; 7300.0=current_price_context; 7313.0=target_or_response; 7336.0=current_price_context; 7366.0=current_price_context
- Time mentions: 12:20PM, 6:20AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: Yesterday (Monday) at 12:20PM - shortly after this backtest - ES put in a monster Failed Breakdown of Monday’s 6:20AM 7213 major low, and we ripped all day today. Now ES is forming a big range mostly 7212-13 to 7300. My lean is we can fill this out more (entries discussed above), then breakout targets 7313, 7336, 7366. Bear case d...
- Nearest support context: line 464: Supports are: 7287 (major), 7283, 7279 (major), 7274, 7268 (major), 7263, 7258 (major), 7254, 7248 (major), 7242, 7236, 7223 (major), 7213 (major), 7204, 7200, 7194, 7189 (major), 7181, 7173, 7165 (major), 7153, 7147 (major), 7136, 7128, 7122, 7111 (major), 7104, 7096, 7085, 7079 (major), 7074, 7068, 7058 (major), 7052, 7049 (major), 7042, 7036 (major), 7...
- Nearest resistance context: line 468: Resistances are: 7296, 7300 (major), 7304, 7309, 7313 (major), 7317, 7322, 7328, 7336 (major), 7340, 7349 (major), 7353, 7359, 7366 (major), 7374, 7382 (major), 7388, 7395 (major), 7405, 7412, 7422 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like them and don’t mind h...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:493 `needs_bigger_crop`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: actual_recap
- Levels: setup=7137.0; swept/lost=7132.0; recovered=7137.0; non_acceptance=none; invalidation=none; target/response=7248.0
- Level roles: 7137.0=actual_setup_level+recovered_level; 7190.0=current_price_context; 7132.0=swept_lost_low; 7248.0=target_or_response
- Time mentions: 3:30PM, 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this dynamic last Wednesday evening after earnings. I wrote Wednesday at 3:30PM: “The only setup is interest is the Failed Breakdown of today’s low which is at 7137. If we can trap this and recover, one can try the long.” Around 420PM ES went elevator down on earnings from 7190 to 7132, getting bears chasing. Institutions trapped them when we sold ...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:495 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7253.0
- Level roles: 7198.0=current_price_context; 7135.0=current_price_context; 7137.0=actual_setup_level; 7188.0=current_price_context; 7253.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: 4pm, 10am
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: This rally had the effect of breaking ES out from a week long bull flag that was mostly 7198 to 7135. On Friday, I was looking for this breakout to run, stating Thursday at 4pm: “We are up 110 points from yesterday’s 420PM 7137 Failed Breakdown. In doing so, ES broke out its week long 7188/7198 to 7135 range. There is nothing to do now but ride runner unt...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:533 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7085.0, 7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level
- Time mentions: 4pm, 1:50PM, 4:20PM
- S/R coincidence: 7085.0=coincides_cleanly; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM Thursday April 23rd Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown Wednesday, discussed above.”
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:543 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7297.0
- Level roles: 7132.0=current_price_context; 7137.0=swept_lost_low; 7297.0=target_or_response
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We got this at aroud 4:20PM Wednesday. In selling to 7132 ES lost 7137 which was the low of day for the entire session on Wednesday. It recovered shortly after, and we ripped to 7297 Friday to close out the week.
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:545 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7240.0, 7248.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7275.0
- Level roles: 7240.0=swept_lost_low; 7248.0=swept_lost_low; 7275.0=target_or_response
- Time mentions: 6pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then very late Friday? The cycle repeats. Elevator down to 7240. In doing so, ES lost the 7248 zone that had held as the low most the session. Sunday evening at 6pm that low recovered (Failed Breakdown) and we ripped to 7275 last evening.
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:557 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7135.0=current_price_context; 7198.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was described in Friday’s newsletter. The Thursday/Friday rally last week was caused by a twofold combination that causes most big moves. 1) A week long range had built 7135 to 7198 mostly. Bull flag 2) We saw a Failed breakdown of that range Wednesday after earnings once it was mature. 3) We then ripped. Now, bulls n...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:559 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7248.0=current_price_context; 7300.0=current_price_context; 7285.0=current_price_context; 7323.0=current_price_context; 7337.0=current_price_context
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out and we made yet another ATH today. There is therefore not much to say here. This rip had two causes. Firstly the initial catalyst was - as always - a Failed Breakdown after earnings Wednesday at 4:20PM of 7137 which was Wednesday’s daily low. Secondly, this rip then broke ES out of a range/bull flag w...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:573 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7248.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7248.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Friday Late Day and the 7248 Failed Breakdown
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:577 `needs_bigger_crop`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: planned_setup
- Levels: setup=7248.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=actual_setup_level
- Time mentions: 4pm, 5am
- S/R coincidence: 7248.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 7248. I wrote Friday at 4pm: “7248 is below there. There is a nice shelf at 7248 and at 5am we set a big low there from which we rallied 50+ points. The Failed Breakdown of this is actionable. If that fails we probably start a nice retracement finally.”
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:579 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7247.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7247 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:581 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 7248 we had #1. 7248 was basically the daily low for Friday and it held for the entire session. The flush and recovery would be actionable.
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:590 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7253.0; invalidation=none; target/response=none
- Level roles: 7248.0=current_price_context; 7253.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7248) by 5 points (7253) and holds at or above 7253 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:596 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: actual_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7267.0=current_price_context; 7248.0=current_price_context; 7253.0=current_price_context
- Time mentions: 6pm, 3:50PM, 4:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: On Sunday at 6pm, futures opened with an big gap up to 7267. This was very unfortunate timing on this Failed Breakdown because markets closed just as the long was about to trigger, then opened with a gap up. If this same Failed Breakdown occurred at 3:50PM Friday instead of 4:50PM, ES would have recovered 7248, ran to the 7253 non-acceptance protocol elig...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:604 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7240.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7240.0=actual_setup_level
- Time mentions: 8am
- S/R coincidence: 7240.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Monday Morning and the 8am 7240 Failed Breakdown
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:606 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7266.0=current_price_context; 7213.0=current_price_context
- Time mentions: 6am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When I woke up and checked price at 730AM, I noticed we got a nice elevator down sell at 6am from 7266 to 7213. If you want to see what an elevator down sell looks like - this is what they look like. A fast flush that cuts every support and often covers 20-200 points in no time at all. There is a sentiment component as well, if you are on social media you...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:608 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7237.0=current_price_context; 7212.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote Friday at 4pm: “Watch for Failed Breakdowns of 7237 (take profits fast on this one) and not much under there until 7212. If its a slow, controlled grind into 7212 one can try a bid here but remember my core rule in ES: No knife catching allowed. If we are selling vertically you never long.”
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:610 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7240.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=current_price_context; 7240.0=actual_setup_level; 7275.0=current_price_context
- Time mentions: 6:20AM
- S/R coincidence: 7240.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: We held 7213 at 6:20AM but this would have been too fast a drop for me to bid instantly. For those who were awake then though, there was a great Failed Breakdown available. Specifically on Friday right before the close (and after the newsletter came out) we set an obvious significant low at 7240. It was from this low that ES rallied to the 7275 evening hi...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:622 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7213.0=actual_setup_level
- Time mentions: 11am, 12:20PM
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 11am Elevator Down Sell into 12:20PM 7213 Failed Breakdown
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:628 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7198.0=current_price_context; 7213.0=actual_setup_level; 7218.0=current_price_context; 7228.0=current_price_context
- Time mentions: 12:10PM, 12:13PM, 12:20PM
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: By 12:10PM, ES backtested ~7198 and then by 12:13PM we backtestd 7213. One could long the Failed Breakdown of 7213 via the non-acceptance protocol 7213+5=7218. I took the long here small size at 12:20PM given it was the second trade of the day. I locked in gains here at 7228 1st up, left a runner to work.
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:643 `needs_bigger_crop`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: planned_setup
- Levels: setup=7199.0, 7137.0, 7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7213.0=actual_setup_level; 7198.0=current_price_context; 7194.0=current_price_context; 7220.0=current_price_context; 7217.0=current_price_context; 7199.0=actual_setup_level; 7181.0=current_price_context; 7160.0=current_price_context; 7157.0=current_price_context; 7154.0=current_price_context; 7134.0=current_price_context
- Time mentions: 4:20PM, 12:20PM, 2:40PM
- S/R coincidence: 7199.0=coincides_cleanly; 7137.0=coincides_partially; 7213.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 7213.0:artifacts\research\mancini-real-packet-gallery\142_accepted_non_acceptance_protocol_20260430_1233_7213.0.svg visual=dangerous_demote_for_training
- Blockers: multi_setup_row_split_required, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from 4:20PM 7137 Failed breakdown last Wednesday. My most recent entry was the 12:20PM 7213 Failed breakdown discussed above. Today we finally got a return to abit more “normal” price action after what was a couple of weeks of straight grind up. Readers know I always say that while I o...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...

### data\research\mancini\The Longer Mancini Logs.txt:647 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7199.0=current_price_context; 7213.0=actual_setup_level; 7240.0=current_price_context; 7268.0=current_price_context; 7194.0=current_price_context; 7177.0=current_price_context
- Time mentions: none
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\142_accepted_non_acceptance_protocol_20260430_1233_7213.0.svg trap=7205.5 reclaim=2026-04-30T12:30:00-04:00 threshold_hold=1 visual=dangerous_demote_for_training visual_reasons=source_text_is_target_or_context_not_failed_breakdown_proof overlap=7
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap, visual_sanity_dangerous_demote_for_training
- Source: Bull case tomorrow: Last Thursday ES broke out of a week long range that roughly had resistance at 7199-94. Today, we backtested it and defended. In a very strong bull case, ES will continue to defend this backtest (perhaps a quick trap of today’s 7199 low at best). From there, ES will begin to build out a new range. In a really strong bull case though, E...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...

### data\research\mancini\The Longer Mancini Logs.txt:649 `negative_control`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7194.0=current_price_context; 7190.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7194. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:651 `data_only`

- Context: Today's Small SPX Dip Was Bought. Are The Lows Already In? May 5th Plan | pub=2026-05-04 | plan=2026-05-05
- Source mode: context_recap
- Levels: setup=7213.0; swept/lost=7199.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7300.0
- Level roles: 7199.0=swept_lost_low; 7300.0=target_or_response; 7213.0=actual_setup_level; 7240.0=current_price_context; 7268.0=current_price_context; 7194.0=current_price_context; 7177.0=current_price_context
- Time mentions: none
- S/R coincidence: 7213.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\142_accepted_non_acceptance_protocol_20260430_1233_7213.0.svg trap=7205.5 reclaim=2026-04-30T12:30:00-04:00 threshold_hold=1 visual=dangerous_demote_for_training visual_reasons=source_text_is_target_or_context_not_failed_breakdown_proof overlap=7
- Blockers: chart_trap_low_7205.5_mismatch_stated_sweep_7199.0, source_mode_context_recap, visual_sanity_dangerous_demote_for_training
- Source: In summary for tomorrow: On Thursday, ES broke out of a week long range with resistance roughly at 7199 and we rallied to 7300. Today, we backtested it and defended. Shortly after this back-test - a little after noon today - ES put in a Failed Breakdown where we lost a major 620AM 7213 low down to 7199 as stated, recovered, and ripped. My general lean is ...
- Nearest support context: line 641: Supports are: 7230, 7220 (major), 7212, 7208 (major), 7199, 7194 (major), 7188, 7181 (major), 7172, 7165, 7160 (major), 7154, 7148, 7142 (major), 7135 (major), 7128, 7121 (major), 7110, 7104 (major), 7094, 7085 (major), 7080, 7074 (major), 7067, 7057 (major), 7054, 7049 (major), 7041, 7034, 7026, 7020, 7016 (major), 7007, 7002 (major), 6990, 6983, 6979 (m...
- Nearest resistance context: line 645: Resistances are: 7238, 7242 (major), 7248 (major), 7258, 7263, 7268 (major), 7272, 7277 (major), 7282, 7289 (major), 7296, 7302 (major), 7311, 7319, 7326, 7333 (major), 7341, 7348 (major), 7358, 7368, 7375 (major), 7385, 7392 (major), 7400, 7408, 7416 (major), 7420, 7426, 7438, 7444 (major). As readers know I don’t short ES - I only get my points on the l...

### data\research\mancini\The Longer Mancini Logs.txt:668 `needs_bigger_crop`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: actual_recap
- Levels: setup=7137.0; swept/lost=7132.0; recovered=7137.0; non_acceptance=none; invalidation=none; target/response=7248.0
- Level roles: 7137.0=actual_setup_level+recovered_level; 7190.0=current_price_context; 7132.0=swept_lost_low; 7248.0=target_or_response
- Time mentions: 3:30PM, 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this dynamic Wednesday evening after earnings. I wrote Wednesday at 3:30PM: “The only setup is interest is the Failed Breakdown of today’s low which is at 7137. If we can trap this and recover, one can try the long.” Around 420PM ES went elevator down on earnings from 7190 to 7132, getting bears chasing. Institutions trapped them when we sold down ...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:672 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7253.0
- Level roles: 7137.0=actual_setup_level; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7253.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: 3:30PM, 10am
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The task for bulls today was to keep this breakout going since we made all time highs. I wrote yesterday at 3:30PM: “We are up 110 points from yesterday’s 420PM 7137 Failed Breakdown. In doing so, ES broke out its week long 7188/7198 to 7135 range. There is nothing to do now but ride runner until we get a dip. Next slate of targets are 7253, 7267, 7297.” ...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:708 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7085.0, 7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level
- Time mentions: 4pm, 1:50PM, 4:20PM
- S/R coincidence: 7085.0=does_not_coincide; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM last Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown Wednesday, discussed above.”
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:718 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7275.0
- Level roles: 7132.0=current_price_context; 7137.0=swept_lost_low; 7275.0=target_or_response
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We got this at aroud 4:20PM Wednesday. In selling to 7132 ES lost 7137 which was the low of day for the entire session on Wednesday. It recovered shortly after, and we ripped to 7275+ today.
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:728 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7252.0
- Level roles: 7137.0=current_price_context; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7252.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out today and we are closing at all time highs an high of day. There is therefore not much to say here. Today’s rip was - as always - caused by a Failed Breakdown after earnings yesterday of 7137 which was yesterday’s daily low. Today’s rip also broke ES out of a range we had built all week which - as of ...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:750 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7198.0=current_price_context; 7035.0=current_price_context; 7188.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Secondly, ES spent last week mostly in a range as discussed above mostly 7198/88 to 7035. Yesterday, we broke out the range. As such, there were no entries until 7188 at least to backtest the structure. There was also a Failed Breakdown available here.
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:752 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context
- Time mentions: 3:30pm, 11:45AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote yesterday at 3:30pm: “7188 is below there and this is the first zone of moderate interest. At 11:45AM today, we set a nice low at 7188 from which we ripped to the high of day. A flush and recovery of this low would be the first Failed Breakdown. If bulls cannot stick this, it likely means today’s breakout was a failed breakdown and we need to buil...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:754 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7188 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:765 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7193.0; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context; 7193.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7188) by 5 points (7193) and holds at or above 7193 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:796 `needs_bigger_crop`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: planned_setup
- Levels: setup=7085.0, 7137.0; swept/lost=7193.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level; 7264.0=current_price_context; 7259.0=current_price_context; 7248.0=current_price_context; 7300.0=current_price_context; 7237.0=current_price_context; 7212.0=current_price_context; 7198.0=current_price_context; 7193.0=swept_lost_low; 7160.0=current_price_context; 7157.0=current_price_context; 7167.0=current_price_context
- Time mentions: 1:50PM, 4:20PM, 5am
- S/R coincidence: 7085.0=coincides_partially; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM last Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown this Wednesday, provided in advance and reviewed in Wednesday’s newsletter. This week was a testame...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:800 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7248.0=current_price_context; 7300.0=current_price_context; 7285.0=current_price_context; 7323.0=current_price_context; 7337.0=current_price_context
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out and we made yet another ATH today. There is therefore not much to say here. This rip had two causes. Firstly the initial catalyst was - as always - a Failed Breakdown after earnings Wednesday at 4:20PM of 7137 which was Wednesday’s daily low. Secondly, this rip then broke ES out of a range/bull flag w...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:802 `negative_control`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=current_price_context; 7241.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case Monday: Begins below 7248. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mastered...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:804 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-03 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7300.0=current_price_context; 7323.0=current_price_context; 7337.0=current_price_context; 7198.0=current_price_context; 7248.0=current_price_context
- Time mentions: none
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for Monday: This week has been another massively profitable week with our Wednesday 420PM Failed Breakdown of 7137 paying out 150+ points. Now ES needs to digest this move. My general lean is ES can spend Monday correcting and consolidation via the above entries before resuming the next leg up to 7300, 7323, then 7337. The lowest bulls want to ...
- Nearest support context: line 794: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 798: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:819 `needs_bigger_crop`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: actual_recap
- Levels: setup=7137.0; swept/lost=7132.0; recovered=7137.0; non_acceptance=none; invalidation=none; target/response=7248.0
- Level roles: 7137.0=actual_setup_level+recovered_level; 7190.0=current_price_context; 7132.0=swept_lost_low; 7248.0=target_or_response
- Time mentions: 3:30PM, 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this dynamic Wednesday evening after earnings. I wrote Wednesday at 3:30PM: “The only setup is interest is the Failed Breakdown of today’s low which is at 7137. If we can trap this and recover, one can try the long.” Around 420PM ES went elevator down on earnings from 7190 to 7132, getting bears chasing. Institutions trapped them when we sold down ...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:823 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7253.0
- Level roles: 7137.0=actual_setup_level; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7253.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: 3:30PM, 10am
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The task for bulls today was to keep this breakout going since we made all time highs. I wrote yesterday at 3:30PM: “We are up 110 points from yesterday’s 420PM 7137 Failed Breakdown. In doing so, ES broke out its week long 7188/7198 to 7135 range. There is nothing to do now but ride runner until we get a dip. Next slate of targets are 7253, 7267, 7297.” ...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:859 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7085.0, 7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level
- Time mentions: 4pm, 1:50PM, 4:20PM
- S/R coincidence: 7085.0=does_not_coincide; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM last Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown Wednesday, discussed above.”
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:869 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7275.0
- Level roles: 7132.0=current_price_context; 7137.0=swept_lost_low; 7275.0=target_or_response
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We got this at aroud 4:20PM Wednesday. In selling to 7132 ES lost 7137 which was the low of day for the entire session on Wednesday. It recovered shortly after, and we ripped to 7275+ today.
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:879 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7252.0
- Level roles: 7137.0=current_price_context; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7252.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out today and we are closing at all time highs an high of day. There is therefore not much to say here. Today’s rip was - as always - caused by a Failed Breakdown after earnings yesterday of 7137 which was yesterday’s daily low. Today’s rip also broke ES out of a range we had built all week which - as of ...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:901 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7198.0=current_price_context; 7035.0=current_price_context; 7188.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Secondly, ES spent last week mostly in a range as discussed above mostly 7198/88 to 7035. Yesterday, we broke out the range. As such, there were no entries until 7188 at least to backtest the structure. There was also a Failed Breakdown available here.
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:903 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context
- Time mentions: 3:30pm, 11:45AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote yesterday at 3:30pm: “7188 is below there and this is the first zone of moderate interest. At 11:45AM today, we set a nice low at 7188 from which we ripped to the high of day. A flush and recovery of this low would be the first Failed Breakdown. If bulls cannot stick this, it likely means today’s breakout was a failed breakdown and we need to buil...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:905 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7188 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:916 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7193.0; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context; 7193.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7188) by 5 points (7193) and holds at or above 7193 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:947 `needs_bigger_crop`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: planned_setup
- Levels: setup=7085.0, 7137.0; swept/lost=7193.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level; 7264.0=current_price_context; 7259.0=current_price_context; 7248.0=current_price_context; 7300.0=current_price_context; 7237.0=current_price_context; 7212.0=current_price_context; 7198.0=current_price_context; 7193.0=swept_lost_low; 7160.0=current_price_context; 7157.0=current_price_context; 7167.0=current_price_context
- Time mentions: 1:50PM, 4:20PM, 5am
- S/R coincidence: 7085.0=coincides_partially; 7137.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM last Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown this Wednesday, provided in advance and reviewed in Wednesday’s newsletter. This week was a testame...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:951 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7248.0=current_price_context; 7300.0=current_price_context; 7285.0=current_price_context; 7323.0=current_price_context; 7337.0=current_price_context
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out and we made yet another ATH today. There is therefore not much to say here. This rip had two causes. Firstly the initial catalyst was - as always - a Failed Breakdown after earnings Wednesday at 4:20PM of 7137 which was Wednesday’s daily low. Secondly, this rip then broke ES out of a range/bull flag w...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:953 `negative_control`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7248.0=current_price_context; 7241.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case Monday: Begins below 7248. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mastered...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:955 `data_only`

- Context: SPX Closes At Major ATHs. Pullback Next Week, or More Upside Ahead? May 4th Plan | pub=2026-05-01 | plan=2026-05-04
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7300.0=current_price_context; 7323.0=current_price_context; 7337.0=current_price_context; 7198.0=current_price_context; 7248.0=current_price_context
- Time mentions: none
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for Monday: This week has been another massively profitable week with our Wednesday 420PM Failed Breakdown of 7137 paying out 150+ points. Now ES needs to digest this move. My general lean is ES can spend Monday correcting and consolidation via the above entries before resuming the next leg up to 7300, 7323, then 7337. The lowest bulls want to ...
- Nearest support context: line 945: Supports are: 7264 (major), 7257, 7253, 7248 (major), 7241, 7237 (major), 7228, 7220, 7212 (major), 7205, 7198 (major), 7194, 7188, 7181 (major), 7172, 7165, 7160 (major), 7153, 7153, 7147 (major), 7142 (major), 7135, 7129, 7121 (major), 7111, 7103, 7094, 7086 (major), 7080, 7074 (major), 7063, 7058, 7054 (major), 7049 (major), 7041, 7034, 7025 (major), 7...
- Nearest resistance context: line 949: Resistances are: 7275, 7285 (major), 7296, 7300, 7308 (major), 7313, 7323 (major), 7329, 7337 (major), 7350, 7355 (major), 7365, 7371 (major), 7382, 7387 (major), 7395, 7403, 7411 (major), 7415 (major), 7422, 7427, 7440-43 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who l...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:972 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=none; swept/lost=7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7221.0
- Level roles: 7160.0=current_price_context; 7080.0=current_price_context; 7085.0=swept_lost_low; 7221.0=target_or_response
- Time mentions: 1pm, 4pm, 1:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw this dynamic Thursday last week. A little after 1pm Thursday ES went elevator down from 7160’s to 7080 within an hour. In doing so, ES lost support of 7085 which was a big set of lows from last Sunday/Tuesday. I wrote Wednesday at 4pm: “7085 is below there and as stated this was a massive low of day yesterday and Sunday. A Failed Breakdown of this ...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:974 `needs_bigger_crop`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: actual_recap
- Levels: setup=7137.0; swept/lost=7132.0; recovered=7137.0; non_acceptance=none; invalidation=none; target/response=7200.0
- Level roles: 7137.0=actual_setup_level+recovered_level; 7132.0=swept_lost_low; 7200.0=target_or_response
- Time mentions: 3:30PM, 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Yesterday, ES put in another incredible Failed Breakdown after earnings. I wrote Wednesday at 3:30PM: “The only setup is interest is the Failed Breakdown of today’s low which is at 7137. If we can trap this and recover, one can try the long.” Around 420PM we flushed on earnings, getting bears chasing. Institutions trapped them when we sold down to 7132, r...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1012 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=7085.0, 7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7147.0=actual_setup_level
- Time mentions: 3:30PM, 1:50PM, 11:57AM
- S/R coincidence: 7085.0=coincides_cleanly; 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 3:30PM (newsletter was sent out early due to earnings): “I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 11:57AM 7147 Failed breakdown today, ...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1022 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7200.0
- Level roles: 7132.0=current_price_context; 7137.0=swept_lost_low; 7200.0=target_or_response
- Time mentions: 4:20PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We got this at aroud 4:20PM yesterday. In selling to 7132 ES lost 7137 which was the low of day for the entire session on Wednesday. It recovered shortly after, and we ripped to 7200+ this morning.
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1030 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7137.0=swept_lost_low; 7189.0=current_price_context
- Time mentions: 3pm, 8pm, 2am, 3:30pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was that ES was stuck in a tight range. This range mostly had support at 7147 which had tested/trapped 10+ times including one after FOMC yesterday close to 3pm where it flushed down to 7137 and recovered. Resistance was 7189 which held 2x between 8pm Tuesday and 2am Wednesday. I expanded on this range and what to do ...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1048 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level
- Time mentions: 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Wednesday Evening and the 4:20PM 7137 Failed Breakdown
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1052 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0, 7147.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=swept_lost_low; 7137.0=swept_lost_low; 7189.0=current_price_context
- Time mentions: 2:58PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The basic context heading into today was twofold. Firstly - at 2:58PM yesterday - ES flushed a multitouch shelf of lows at 7147 down to 7137, and recovered. 7147 was support of a consolidation or what I call a Mode 2 Range that had been in play for 48hrs 7147-7189, discussed above.
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1058 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Ranges like this are what I call Mode 2. Mode 2 is easy to trade as long as you follow the rules. 1) Do not predict price action. Do not predict what path price will take to fill out the range, when it will breakout, or how it will breakout. If you try to predict, you’ve lost already. Simply plan triggers, react. 2) Always manage trades level to level. In...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1060 `needs_bigger_crop`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: planned_setup
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=actual_setup_level; 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first high quality possible entry was down was a Failed Breakdown of 7137. I wrote yesterday at 330PM: “7147 is first support down of interest. This level is totally washed out now and I would never buy it. The only setup is interest is the Failed Breakdown of today’s low which is at 7137. If we can trap this and recover, one can try the long. If you ...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1062 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7137.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7137 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1073 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7142.0; invalidation=none; target/response=none
- Level roles: 7137.0=current_price_context; 7142.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7137) by 5 points (7142) and holds at or above 7142 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1075 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=7132.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7189.0=current_price_context; 7132.0=swept_lost_low; 7137.0=actual_setup_level
- Time mentions: 4:00PM, 4pm, 4:20PM
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Around 4:00PM, earnings trapping began. I wrote yesterday at 4pm: “Note we have earnings at 4pm so expect fast, wild, trappy, algo driven swings.” We trapped up to ~7189 range resistance, then trapped down to 7132 by 4:20PM. Just after that, we got the 7137 Failed Breakdown discussed above.
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1087 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=7160.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7160.0=actual_setup_level
- Time mentions: 10:18AM
- S/R coincidence: 7160.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Thursday Morning and the 10:18AM 7160 Failed Breakdown
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: render ES 1m from 2026-04-28T10:31:00-04:00 minus 60 minutes through 2026-04-28T12:35:00-04:00 plus 90 minutes; trap_low=7148.75; reclaim=2026-04-28T12:35:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1123 `needs_bigger_crop`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: planned_setup
- Levels: setup=7085.0, 7137.0, 7135.0, 7180.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7137.0=actual_setup_level; 7160.0=current_price_context; 7219.0=current_price_context; 7212.0=current_price_context; 7188.0=current_price_context; 7198.0=current_price_context; 7161.0=current_price_context; 7157.0=current_price_context; 7167.0=current_price_context; 7141.0=current_price_context; 7135.0=actual_setup_level; 7095.0=current_price_context; 7180.0=actual_setup_level
- Time mentions: 1:50PM, 4:20PM, 10:20AM, 11:45AM
- S/R coincidence: 7085.0=coincides_cleanly; 7137.0=coincides_partially; 7135.0=coincides_cleanly; 7180.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM last Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 4:20PM 7137 Failed breakdown Wednesday, discussed above. We saw some fantastic Failed Breakdowns leading to today’s squeezes. Th...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1127 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7252.0
- Level roles: 7137.0=current_price_context; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7252.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: The bull case has fully played out today and we are closing at all time highs an high of day. There is therefore not much to say here. Today’s rip was - as always - caused by a Failed Breakdown after earnings yesterday of 7137 which was yesterday’s daily low. Today’s rip also broke ES out of a range we had built all week which - as of ...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1129 `negative_control`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7188.0=current_price_context; 7180.0=current_price_context; 7176.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7188. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1131 `data_only`

- Context: Bulls Bought The Earnings Dip In SPX. Has The Next Leg Up Begun? May 1st Plan | pub=2026-04-30 | plan=2026-05-01
- Source mode: context_recap
- Levels: setup=7137.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7253.0
- Level roles: 7137.0=actual_setup_level; 7188.0=current_price_context; 7198.0=current_price_context; 7135.0=current_price_context; 7253.0=target_or_response; 7267.0=current_price_context; 7297.0=current_price_context; 7189.0=current_price_context
- Time mentions: none
- S/R coincidence: 7137.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for tomorrow: We are up 110 points from yesterday’s 420PM 7137 Failed Breakdown. In doing so, ES broke out its week long 7188/7198 to 7135 range. There is nothing to do now but ride runner until we get a dip. Next slate of targets are 7253, 7267, 7297. 7189/7198 must defend on any backtests.
- Nearest support context: line 1121: Supports are: 7233 (major), 7228, 7224, 7219 (major), 7212 (major), 7208, 7204, 7198, 7193, 7188 (major), 7180, 7174, 7165, 7161 (major), 7152, 7147, 7141 (major), 7135 (major), 7129, 7121 (major), 7111, 7103, 7095 (major), 7085, 7080 (major), 7073, 7068, 7058 (major), 7054, 7048 (major), 7042, 7035, 7029, 7016-20 (major), 7013, 7008, 7002 (major), 6999, ...
- Nearest resistance context: line 1125: Resistances are: 7238, 7242 (major), 7251 (major), 7265, 7272, 7276 (major), 7287, 7297 (major), 7305, 7310, 7328 (major), 7343, 7351 (major), 7358, 7366 (major), 7380, 7384 (major), 7390 (major), 7398, 7406 (major), 7416 (major), 7421, 7427, 7435 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short ent...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1145 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=none; swept/lost=7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7200.0
- Level roles: 7160.0=current_price_context; 7080.0=current_price_context; 7085.0=swept_lost_low; 7200.0=target_or_response
- Time mentions: 1pm, 4pm, 1:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw this dynamic Thursday last week. A little after 1pm Thursday ES went elevator down from 7160’s to 7080 within an hour. In doing so, ES lost support of 7085 which was a big set of lows from last Sunday/Tuesday. I wrote Wednesday at 4pm: “7085 is below there and as stated this was a massive low of day yesterday and Sunday. A Failed Breakdown of this ...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1149 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7137.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7160.0
- Level roles: 7147.0=current_price_context; 7137.0=swept_lost_low; 7160.0=target_or_response
- Time mentions: 4pm, 1pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The task for bulls today was to try and buy any earnings/FOMC dips. I wrote yesterday at 4pm: “7147 is below there. This support tested over 5x today and defended each time. The Failed Breakdown of this multi-touch shelf (all of which occurred between 830am and 1pm today) is an obvious entry.” After FOMC today we trapped 7147 down to 7137, recovered, ripp...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1185 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=7085.0, 7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7147.0=actual_setup_level
- Time mentions: 4pm, 1:50PM, 10:55AM
- S/R coincidence: 7085.0=coincides_cleanly; 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 10:55AM 7147 Failed Breakdown.”
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1191 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=7080.0; recovered=7085.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7080.0=swept_lost_low; 7085.0=actual_setup_level+recovered_level; 7200.0=current_price_context
- Time mentions: 1pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: We saw this exactly on Thursday last week. ES went elevator down around 1pm. This elevator down sell took ES rapidly from 7160s at 1pm down to 7080. Shortly after - around 1:50PM - ES recovered a big shelf of lows at 7085 comprising the Sunday last week and Tuesday last week lows. This was a big Failed Breakdown, and we ripped from there to 7200+ on Friday.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1195 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7187.0
- Level roles: 7224.0=current_price_context; 7147.0=current_price_context; 7187.0=target_or_response
- Time mentions: 10:50AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then overnight into Tuesday morning? ES went elevator down from 7224 to 7147 by 830AM. We bounced 30 points there, then at 10:50AM, swept that shelf at 7147 (Failed Breakdown) and rallied into 7187 last evening.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1197 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: actual_recap
- Levels: setup=7147.0; swept/lost=7137.0; recovered=7147.0; non_acceptance=none; invalidation=none; target/response=7161.0
- Level roles: 7137.0=swept_lost_low; 7147.0=actual_setup_level+recovered_level; 7161.0=target_or_response
- Time mentions: 2pm, 3pm
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Today, we repeated the cycle, selling off down to 7137 after FOMC at 2pm. We then recovered that 7147 shelf after FOMC again (Failed Breakdown) and rallied to 7161+ by 3pm.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: render ES 1m from 2026-04-23T22:30:00-04:00 minus 60 minutes through 2026-04-24T00:32:00-04:00 plus 90 minutes; trap_low=7137.0; reclaim=2026-04-24T00:32:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1205 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: data_context
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7225.0
- Level roles: 7080.0=current_price_context; 7180.0=current_price_context; 7225.0=target_or_response
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was that ES spent all last week resting and consolidating after a massive 100+ point rally last Friday. Generally this consolidation formed a large range with 7080 support (this was the Sunday low and Tuesday low last week) and 7180 resistance (this was a downsloping trendline connecting the last Friday high, last Tue...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1207 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=7180.0; swept/lost=7180.0; recovered=7180.0; non_acceptance=none; invalidation=none; target/response=7225.0
- Level roles: 7080.0=current_price_context; 7180.0=actual_setup_level+swept_lost_low+recovered_level; 7225.0=target_or_response; 7147.0=current_price_context; 7186.0=current_price_context; 7204.0=current_price_context; 7214.0=current_price_context; 7234.0=current_price_context; 7246.0=current_price_context
- Time mentions: 3pm
- S/R coincidence: 7180.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: ES is now in the process of building a highly complex consolidation since April 17. This structure was mostly 7080 support with 7180 resistance. On Friday we broke this structure out. Then all day Monday, 7180 flipped to support, and we ripped to ~7225. Today, we then lost 7180 and it flipped back to resistance much of the session. The...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: render ES 1m from 2026-04-24T06:53:00-04:00 minus 60 minutes through 2026-04-24T10:44:00-04:00 plus 90 minutes; trap_low=7169.0; reclaim=2026-04-24T10:44:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1231 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Ranges like this are what I call Mode 2. Mode 2 is easy to trade as long as you follow the rules. 1) Do not predict price action. Do not predict what path price will take to fill out the range, when it will breakout, or how it will breakout. If you try to predict, you’ve lost already. Simply plan triggers, react. 2) Always manage trades level to level. In...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1233 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: planned_setup
- Levels: setup=7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=actual_setup_level; 7136.0=current_price_context
- Time mentions: 4pm, 1pm
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first high quality possible entry was down was a Failed Breakdown of 7147. I wrote yesterday at 4pm: “7147 is below there. This support tested over 5x today and defended each time. The Failed Breakdown of this multi-touch shelf (all of which occurred between 830am and 1pm today) is an obvious entry. Bonus if we can tag 7136 or lower on this flush.”
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: render ES 1m from 2026-04-23T22:30:00-04:00 minus 60 minutes through 2026-04-24T00:32:00-04:00 plus 90 minutes; trap_low=7137.0; reclaim=2026-04-24T00:32:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1235 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7147 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1246 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7152.0; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7152.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7147) by 5 points (7152) and holds at or above 7152 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1252 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=actual_setup_level
- Time mentions: 11:57AM
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Wednesday Morning and the 11:57AM 7147 Failed Breakdown
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: render ES 1m from 2026-04-23T22:30:00-04:00 minus 60 minutes through 2026-04-24T00:32:00-04:00 plus 90 minutes; trap_low=7137.0; reclaim=2026-04-24T00:32:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1260 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: data_context
- Levels: setup=none; swept/lost=7145.0, 7147.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=swept_lost_low; 7145.0=swept_lost_low; 7154.0=current_price_context; 7161.0=current_price_context
- Time mentions: 11:55AM, 11:57AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Around 11:55AM, ES finally swept the 7147 support down to 7145. By 11:57AM, we recovered it. I longed here via the non-acceptance protocol at ~7154. This popped to 7161 1st up and I managed as always: Locked in 75% profits, left 25% to run.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1262 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: context_recap
- Levels: setup=7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=actual_setup_level
- Time mentions: 2pm, 2:58PM
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: FOMC 2pm and the 2:58PM 7147 Failed Breakdown
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: render ES 1m from 2026-04-23T22:30:00-04:00 minus 60 minutes through 2026-04-24T00:32:00-04:00 plus 90 minutes; trap_low=7137.0; reclaim=2026-04-24T00:32:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1264 `data_only`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: planned_setup
- Levels: setup=none; swept/lost=7138.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7138.0=swept_lost_low; 7147.0=current_price_context; 7152.0=current_price_context
- Time mentions: 2pm, 2:28PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: FOMC hit at 2pm and ES flushed down to 7138. By 2:28PM, ES popped back above 7147 creating what I call a double dip Failed Breakdown. These are very common. The trigger for this would be 7147+5=7152 so one could long when price holds above 7152 for a few minutes.
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1293 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: planned_setup
- Levels: setup=7085.0, 7137.0, 7068.0, 7147.0; swept/lost=7068.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7147.0=actual_setup_level; 7189.0=current_price_context; 7174.0=current_price_context; 7137.0=actual_setup_level; 7135.0=current_price_context; 7121.0=current_price_context; 7105.0=current_price_context; 7078.0=current_price_context; 7068.0=actual_setup_level+swept_lost_low; 7048.0=current_price_context; 7016.0=current_price_context
- Time mentions: 1:50PM, 11:57AM, 4pm, 3:50PM, 10am
- S/R coincidence: 7085.0=coincides_cleanly; 7137.0=coincides_cleanly; 7068.0=coincides_partially; 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 11:57AM 7147 Failed breakdown today, discussed above. Note we have earnings at 4pm so expect fast, wild, trappy, algo driven swings. ...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1299 `negative_control`

- Context: SPX Is Coiled Tight Again. Is Another Move Coming? What Way? April 30 Plan | pub=2026-04-29 | plan=2026-04-30
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7135.0=current_price_context; 7132.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7135. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 1291: Supports are: 7153, 7147 (major), 7137, 7135 (major), 7126, 7121 (major), 7111, 7102, 7096, 7085 (major), 7078, 7074, 7058 (major), 7054, 7048 (major), 7040 (major), 7035, 7026, 7016-20 (major), 7008, 7003, 6990 (major), 6985, 6975, 6971, 6961 (major), 6955, 6949 (major), 6938, 6927, 6920 (major), 6917, 6907, 6902 (major), 6996, 6887 (major), 6882, 6872 (...
- Nearest resistance context: line 1295: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7189 (major), 7192, 7198, 7204 (major), 7211, 7220 (major), 7225, 7232, 7238 (major), 7248 (major), 7255, 7264 (major), 7273 (major), 7281, 7287, 7293, 7300 (major), 7312, 7324 (major), 7337, 7349 (major), 7359 (major), 7368, 7377, 7381 (major). As readers know I don’t short ES - I only get my point...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30, 2026-05-01

### data\research\mancini\The Longer Mancini Logs.txt:1315 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=none; swept/lost=7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7200.0
- Level roles: 7160.0=current_price_context; 7080.0=current_price_context; 7085.0=swept_lost_low; 7200.0=target_or_response
- Time mentions: 1pm, 4pm, 1:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw this dynamic Thursday last week. A little after 1pm Thursday ES went elevator down from 7160’s to 7080 within an hour. In doing so, ES lost support of 7085 which was a big set of lows from last Sunday/Tuesday. I wrote Wednesday at 4pm: “7085 is below there and as stated this was a massive low of day yesterday and Sunday. A Failed Breakdown of this ...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1369 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=7085.0, 7185.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7185.0=actual_setup_level
- Time mentions: 4pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly; 7185.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 7185.0:artifacts\research\mancini-real-packet-gallery\122_excluded_simple_reclaim_unclassified_20260428_0607_7185.0.svg visual=dangerous_demote_for_training; 7185.0:artifacts\research\mancini-real-packet-gallery\131_accepted_classic_acceptance_second_attempt_reclaim_20260428_1916_7185.0.svg visual=dangerous_demote_for_training
- Blockers: multi_setup_row_split_required, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 840PM 7185 Failed Breakdown from Sunday evening.”
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...

### data\research\mancini\The Longer Mancini Logs.txt:1375 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=7080.0; recovered=7085.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7080.0=swept_lost_low; 7085.0=actual_setup_level+recovered_level; 7200.0=current_price_context
- Time mentions: 1pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: We saw this exactly on Thursday last week. ES went elevator down around 1pm. This elevator down sell took ES rapidly from 7160s at 1pm down to 7080. Shortly after - around 1:50PM - ES recovered a big shelf of lows at 7085 comprising the Sunday last week and Tuesday last week lows. This was a big Failed Breakdown, and we ripped from there to 7200+ on Friday.
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1379 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7224.0=current_price_context; 7147.0=current_price_context
- Time mentions: 10:50AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then overnight into Tuesday morning? ES went elevator down from 7224 to 7147 by 830AM. We bounced 30 points there, then at 10:50AM, swept that shelf (Failed Breakdown) and rallied into the close.
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1387 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: data_context
- Levels: setup=none; swept/lost=7080.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7180.0=current_price_context; 7080.0=swept_lost_low; 7205.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was that ES spent all last week resting and consolidating building a range, and this range broke upwards on Friday. Generally this consolidation was 7085 support (this was the Sunday low and Tuesday low last week) and 7180 resistance (this was a downsloping trendline connecting the Friday April 17th high, the last Tue...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1405 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=7180.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7180.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Monday Evening and the Un-Triggered 7180 Failed Breakdown
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: render ES 1m from 2026-04-24T06:53:00-04:00 minus 60 minutes through 2026-04-24T10:44:00-04:00 plus 90 minutes; trap_low=7169.0; reclaim=2026-04-24T10:44:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1415 `needs_bigger_crop`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: planned_setup
- Levels: setup=7180.0, 7161.0; swept/lost=7161.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=actual_setup_level; 7175.0=current_price_context; 7177.0=current_price_context; 7161.0=actual_setup_level+swept_lost_low
- Time mentions: 4pm, 4:20AM, 9:45AM, 11:25AM
- S/R coincidence: 7180.0=coincides_partially; 7161.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: The first high quality possible entry was down was a Failed Breakdown of 7180-75. I wrote yesterday at 4pm: “Next down is 7175-80 and this is where I get a little more interested with this zone being range support. There was a clear shelf of lows at 7180. At 4:20AM Monday and 9:45AM Monday ES set 18 point lows there on each respective bounce. Then at 11:2...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1417 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7175.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7175-80 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1428 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7185.0; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7185.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7180) by 5 points (7185) and holds at or above 7185 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1442 `needs_bigger_crop`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: planned_setup
- Levels: setup=7135.0, 7180.0, 7149.0; swept/lost=7149.0, 7224.0, 7180.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7224.0=swept_lost_low; 7149.0=actual_setup_level+swept_lost_low; 7180.0=actual_setup_level+swept_lost_low; 7135.0=actual_setup_level
- Time mentions: 4pm
- S/R coincidence: 7135.0=coincides_partially; 7180.0=coincides_partially; 7149.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In this case, ES flushed from 7224 down to 7149 or so by 830am. We flushed through the 7180 support, and the 7180 Failed Breakdown discussed above never triggered, therefore we simply move to the next planned trigger down. This was the 7149 Failed Breakdown. I wrote yesterday at 4pm: “Nothing below there until 7149. This is a decent support. If its a cont...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1444 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context
- Time mentions: 8:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This was a very controlled, organized dip into 7147 by 8:30AM. One could’ve bid this and been paid nicely. As usual though, I prefer just to wait for a Failed Breakdown and if we don’t get one, I just let my runners keep paying.
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1450 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: data_context
- Levels: setup=7147.0; swept/lost=7146.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7146.0=swept_lost_low; 7147.0=actual_setup_level; 7153.0=current_price_context; 7155.0=current_price_context
- Time mentions: 10:50AM, 10:55AM
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_data_context
- Source: At around 10:50AM ES then sold off from 7180 and sold down to 7146. In doing so, ES lost the ~830AM 7147 low by 1 point. We recovered that low immediately after, and I decided to take the long here via the non-acceptance protocol. 7147+5=7153. I longed at 7155 at 10:55AM or so.
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: render ES 1m from 2026-04-22T19:27:00-04:00 minus 60 minutes through 2026-04-22T19:28:00-04:00 plus 90 minutes; trap_low=7145.5; reclaim=2026-04-22T19:28:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1476 `needs_bigger_crop`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: planned_setup
- Levels: setup=7085.0, 7104.0, 7068.0, 7147.0; swept/lost=7068.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7147.0=actual_setup_level; 7205.0=current_price_context; 7180.0=current_price_context; 7161.0=current_price_context; 7136.0=current_price_context; 7120.0=current_price_context; 7104.0=actual_setup_level; 7078.0=current_price_context; 7068.0=actual_setup_level+swept_lost_low; 7048.0=current_price_context; 7016.0=current_price_context
- Time mentions: 1:50PM, 10:55AM, 2pm, 5pm, 1pm, 3:50PM, 10am
- S/R coincidence: 7085.0=coincides_cleanly; 7104.0=coincides_cleanly; 7068.0=coincides_cleanly; 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 10:55AM 7147 Failed Breakdown. I would very strongly encourage readers to read slowly and carefully the FOMC/earnings guide above. Th...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1480 `data_only`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: context_recap
- Levels: setup=7180.0; swept/lost=7180.0; recovered=7180.0; non_acceptance=none; invalidation=none; target/response=7225.0
- Level roles: 7080.0=current_price_context; 7180.0=actual_setup_level+swept_lost_low+recovered_level; 7225.0=target_or_response; 7147.0=current_price_context; 7186.0=current_price_context; 7204.0=current_price_context; 7214.0=current_price_context; 7234.0=current_price_context; 7246.0=current_price_context
- Time mentions: 3pm
- S/R coincidence: 7180.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: ES is now in the process of building a highly complex consolidation since April 17. This structure was mostly 7080 support with 7180 resistance. On Friday we broke this structure out. Then all day Monday, 7180 flipped to support, and we ripped to ~7225. Today, we then lost 7180 and it flipped back to resistance much of the session. The...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: render ES 1m from 2026-04-24T06:53:00-04:00 minus 60 minutes through 2026-04-24T10:44:00-04:00 plus 90 minutes; trap_low=7169.0; reclaim=2026-04-24T10:44:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1482 `negative_control`

- Context: FOMC + Earnings Tomorrow. Expect Volatility In SPX. Will The Rally Continue? April 29 Plan | pub=2026-04-28 | plan=2026-04-29
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7133.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7147. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 1474: Supports are: 7161 (major), 7153, 7147 (major), 7136, 7127, 7120 (major), 7111, 7104 (major), 7095, 7085 (major), 7078 (major), 7074, 7068 (major), 7063, 7058 (major), 7054, 7048 (major), 7041, 7031, 7026, 7016-20 (major), 7013, 7008, 7002 (major), 6991, 6985 (major), 6975, 6971, 6966 (major), 6961, 6956, 6949 (major).
- Nearest resistance context: line 1478: Resistances are: 7160 (major), 7166, 7174 (major), 7181, 7186 (major), 7194, 7198, 7204 (major), 7214 (major), 7219, 7225, 7234, 7246 (major), 7254, 7267 (major), 7272, 7279, 7288, 7298 (major), 7303, 7317 (major), 7322, 7334, 7346 (major), 7354, 7362, 7375 (major), 7383, 7387, 7394, 7400 (major), 7408, 7420, 7424, 7432 (major), 7443, 7448 (major), 7458, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29, 2026-04-30

### data\research\mancini\The Longer Mancini Logs.txt:1498 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7200.0
- Level roles: 7160.0=current_price_context; 7080.0=current_price_context; 7085.0=swept_lost_low; 7200.0=target_or_response
- Time mentions: 1pm, 4pm, 1:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw this dynamic Thursday last week. A little after 1pm Thursday ES went elevator down from 7160’s to 7080 within an hour. In doing so, ES lost support of 7085 which was a big set of lows from last Sunday/Tuesday. I wrote Wednesday at 4pm: “7085 is below there and as stated this was a massive low of day yesterday and Sunday. A Failed Breakdown of this ...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1500 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: actual_recap
- Levels: setup=7085.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7204.0
- Level roles: 7180.0=current_price_context; 7085.0=actual_setup_level; 7147.0=current_price_context; 7204.0=target_or_response; 7224.0=current_price_context; 7242.0=current_price_context
- Time mentions: 4pm, 11:25AM
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: Ultimately though, all the action last week was rangebound as ES built a huge flag. This flag was mostly 7180 to 7085. 7180 is a downtrend line from Friday February 17th to last Thursday. 7085 was the shelf forming the lows last week. The job this week was for bulls to defend this breakout (or at least, minimally retrace into the range), then continue up....
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1536 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=7085.0, 7185.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7185.0=actual_setup_level
- Time mentions: 4pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly; 7185.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 7185.0:artifacts\research\mancini-real-packet-gallery\122_excluded_simple_reclaim_unclassified_20260428_0607_7185.0.svg visual=dangerous_demote_for_training; 7185.0:artifacts\research\mancini-real-packet-gallery\131_accepted_classic_acceptance_second_attempt_reclaim_20260428_1916_7185.0.svg visual=dangerous_demote_for_training
- Blockers: multi_setup_row_split_required, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 840PM 7185 Failed Breakdown last evening, discussed above.”
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...

### data\research\mancini\The Longer Mancini Logs.txt:1542 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=7080.0; recovered=7085.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7080.0=swept_lost_low; 7085.0=actual_setup_level+recovered_level; 7200.0=current_price_context
- Time mentions: 1pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: We saw this exactly on Thursday. ES went elevator down around 1pm. This elevator down sell took ES rapidly from 7160s at 1pm down to 7080. Shortly after - around 1:50PM - ES recovered a big shelf of lows at 7085 comprising the Sunday last week and Tuesday last week lows. This was a big Failed Breakdown, and we ripped from there to 7200+ on Friday.
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1552 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: data_context
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7180.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was that ES spent all last week resting and consolidating after a massive 100+ point rally last Friday. Generally this consolidation formed a large range with 7085 support (this was the Sunday low and Tuesday low last week) and 7180 resistance (this was a downsloping trendline connecting the last Friday high, last Tue...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1554 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=7147.0; swept/lost=7080.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7204.0
- Level roles: 7180.0=current_price_context; 7085.0=current_price_context; 7160.0=current_price_context; 7080.0=swept_lost_low; 7204.0=target_or_response; 7224.0=current_price_context; 7242.0=current_price_context; 7259.0=current_price_context; 7147.0=actual_setup_level
- Time mentions: 1:55PM
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case Monday: Bulls remain fully in control. All week ES built a big range 7180 to 7085. Today, we broke it out and now there is nothing to do but hold runner until the next elevator down sell. As always, this massive rally we saw yesterday into today was caused by a classic Failed breakdown at 1:55PM Thursday. ES went elevator down from 7160 down to ...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-23T12:47:00-04:00 minus 60 minutes through 2026-04-23T13:33:00-04:00 plus 90 minutes; trap_low=7079.75; reclaim=2026-04-23T13:33:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1568 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=7185.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7185.0=actual_setup_level
- Time mentions: 8:40PM
- S/R coincidence: 7185.0=does_not_coincide
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, setup_level_does_not_coincide_with_sr_or_prose_context, source_mode_context_recap
- Source: Sunday Evening and the 8:40PM 7185 Failed Breakdown Long
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-24T10:44:00-04:00 minus 60 minutes through 2026-04-24T10:45:00-04:00 plus 90 minutes; trap_low=7172.5; reclaim=2026-04-24T10:45:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1578 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7180.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I would also strongly encourage reading my paragraph on Mode 2 price action at the beginning of the Trade Recap section above as Failed Breakdowns of this caliber are most common in Mode 2 ranges. Not only are they common, they are a defining feature of Mode 2 ranges. Once a range is established (the last week its been mostly 7085 to 7180 as discussed abo...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1582 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=7105.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7180.0
- Level roles: 7105.0=swept_lost_low; 7180.0=target_or_response; 7080.0=current_price_context; 7085.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Ranges like this are what I call Mode 2. Mode 2 is easy to trade as long as you follow the rules. 1) Do not predict price action. Do not predict what path price will take to fill out the range, when it will breakout, or how it will breakout. If you try to predict, you’ve lost already. Simply plan triggers, react. 2) Always manage trades level to level. In...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1584 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: planned_setup
- Levels: setup=7147.0, 7135.0; swept/lost=7180.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=actual_setup_level; 7180.0=swept_lost_low; 7135.0=actual_setup_level
- Time mentions: 4pm, 9:40AM
- S/R coincidence: 7147.0=coincides_cleanly; 7135.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: The first high quality possible entry was down was a Failed Breakdown of 7147. I wrote Friday at 4pm: “If we can flush to 7180 and recover that shelf, it is a high risk trade. Not much of interest below there until 7147 and this is where we get into better quality Failed Breakdowns. Specifically at ~9:40AM Friday ES set a big low at ~7147. It was from thi...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1586 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7147 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1597 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7153.0; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7153.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7147) by 5 points (7153) and holds at or above 7153 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1601 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: planned_setup
- Levels: setup=7180.0, 7147.0; swept/lost=7180.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=actual_setup_level; 7180.0=actual_setup_level+swept_lost_low; 7185.0=current_price_context
- Time mentions: 4pm, 2:30PM
- S/R coincidence: 7180.0=coincides_cleanly; 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In advance of the 7147 Failed Breakdown, there was a lower quality Failed Breakdown of 7180, I wrote on Friday at 4pm: “A very high risk entry for those wanting to trade though would be if we can roughly defend 7180, then recover 7185. Between noon and 2:30PM today, ES set a shelf of lows at 7185. If we can flush to 7180 and recover that shelf, it is a hi...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1603 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: planned_setup
- Levels: setup=7185.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7185.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7185.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: This was obviously quite low quality Failed breakdown. Why? There was no significant low at 7185. From noon until Friday’s close ES did build a small shelf there (which technically meets the 3rd criteria for a significant low - a shelf of lows - but we only bounced about 13 points off this making it very weak as a significant low overall). When it comes t...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-24T10:44:00-04:00 minus 60 minutes through 2026-04-24T10:45:00-04:00 plus 90 minutes; trap_low=7172.5; reclaim=2026-04-24T10:45:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1617 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=7180.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=actual_setup_level
- Time mentions: 11:25AM
- S/R coincidence: 7180.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Monday Morning and the 11:25AM 7180 Failed Breakdown
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-24T06:53:00-04:00 minus 60 minutes through 2026-04-24T10:44:00-04:00 plus 90 minutes; trap_low=7169.0; reclaim=2026-04-24T10:44:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1619 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: planned_setup
- Levels: setup=7147.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7208.0=current_price_context; 7147.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: When I woke up and checked price at 730AM Monday, I was happy to see we had ran nicely overnight to 7208+. As always, there is nothing for me to do now but wait patiently for the next elevator down sell and the next fresh, planned setup, which was the 7147 Failed Breakdown discussed above.
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: render ES 1m from 2026-04-22T01:08:00-04:00 minus 60 minutes through 2026-04-22T07:04:00-04:00 plus 90 minutes; trap_low=7137.0; reclaim=2026-04-22T07:04:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1625 `data_only`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: context_recap
- Levels: setup=none; swept/lost=7177.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7147.0=current_price_context; 7177.0=swept_lost_low
- Time mentions: 4pm, 11:25AM, 4:20AM, 9:45AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: While I already got my points for the day so I was good with not trading - there were entries for those interested. On Friday at 4pm, I wrote: “My general lean is to defer to the trend. Bulls want to hold 7180 or 7147 (watch traps) on a Monday retrace.” At 11:25AM, we trapped 7180, recovered, and popped 15 points. This was a straightforward Failed Breakdo...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1644 `needs_bigger_crop`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: actual_recap
- Levels: setup=7085.0, 7161.0, 7135.0, 7080.0, 7185.0; swept/lost=7161.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=actual_setup_level; 7185.0=actual_setup_level; 7175.0=current_price_context; 7200.0=current_price_context; 7198.0=current_price_context; 7180.0=current_price_context; 7177.0=current_price_context; 7161.0=actual_setup_level+swept_lost_low; 7149.0=current_price_context; 7135.0=actual_setup_level; 7121.0=current_price_context; 7080.0=actual_setup_level
- Time mentions: 1:50PM, 4:20AM, 9:45AM, 11:25AM
- S/R coincidence: 7085.0=coincides_cleanly; 7161.0=coincides_cleanly; 7135.0=coincides_cleanly; 7080.0=coincides_partially; 7185.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 7185.0:artifacts\research\mancini-real-packet-gallery\122_excluded_simple_reclaim_unclassified_20260428_0607_7185.0.svg visual=dangerous_demote_for_training; 7185.0:artifacts\research\mancini-real-packet-gallery\131_accepted_classic_acceptance_second_attempt_reclaim_20260428_1916_7185.0.svg visual=dangerous_demote_for_training; 7185.0:artifacts\research\mancini-real-packet-gallery\136_accepted_non_acceptance_protocol_20260429_1717_7185.0.svg visual=insufficient_visual_context
- Blockers: multi_setup_row_split_required
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 1:50PM Thursday Failed Breakdown of 7085 - discussed extensively in Thursday’s newsletter and provided in advance. My most recent entry was the 840PM 7185 Failed Breakdown last evening, discussed above. Today was a slow paced consolidation session or Mode 2 day as I frequently...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...

### data\research\mancini\The Longer Mancini Logs.txt:1650 `negative_control`

- Context: Is the Next Leg Higher About To Start In SPX? Or Pullback Soon? April 28 Plan | pub=2026-04-27 | plan=2026-04-28
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7133.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7147. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 1642: Supports are: 7198 (major), 7193, 7186, 7175-80 (major), 7167, 7161 (major), 7153, 7147 (major), 7135 , 7127, 7121 (major), 7104, 7095, 7085 (major), 7079, 7074, 7068 (major), 7058 (major), 7054, 7048 (major), 7041, 7035 (major), 7021, 7016 (major), 7013, 7007 (major), 7003, 7000 (major), 6990, 6984 (major), 6975, 6962, 6952, 6949 (major), 6943, 6938 (maj...
- Nearest resistance context: line 1646: Resistances are: 7205 (major), 7213, 7221 (major), 7233, 7244 (major), 7252, 7260 (major), 7266, 7274 (major), 7284, 7295, 7302 (major), 7315 (major), 7320, 7330, 7343 (major), 7352, 7363 (major), 7372 (major), 7385, 7392 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who li...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-23, 2026-04-24, 2026-04-27, 2026-04-28, 2026-04-29

### data\research\mancini\The Longer Mancini Logs.txt:1670 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=none; swept/lost=7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7147.0
- Level roles: 7160.0=current_price_context; 7080.0=current_price_context; 7085.0=swept_lost_low; 7147.0=target_or_response
- Time mentions: 1pm, 4pm, 1:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Yesterday, we saw this dynamic again. A little after 1pm ES went elevator down from 7160’s to 7080. In doing so, ES lost support of 7085 which was a big set of lows from Sunday/Tuesday. I wrote Wednesday at 4pm: “7085 is below there and as stated this was a massive low of day yesterday and Sunday. A Failed Breakdown of this low is a high quality trade.” A...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1708 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7085.0, 6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7085.0=actual_setup_level
- Time mentions: 4pm, 8:45PM, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly; 6793.0=does_not_coincide
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 1:50PM Thursday Failed Breakdown of 7085”
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1714 `needs_bigger_crop`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: actual_recap
- Levels: setup=7120.0; swept/lost=7085.0; recovered=7120.0; non_acceptance=none; invalidation=none; target/response=7180.0
- Level roles: 7160.0=current_price_context; 7085.0=swept_lost_low; 7120.0=actual_setup_level+recovered_level; 7180.0=target_or_response
- Time mentions: 6pm, 9:45AM
- S/R coincidence: 7120.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this off the Sunday open this week. We went elevator down from 7160 and flushed to 7085 at 6pm Sunday evening. Shortly after, ES recovered a massive low set at 9:45AM on Friday at 7120 (Failed Breakdown) and rallied to 7180’s yesterday before finally going elevator down yesterday morning ultimately back to 7085 by yesterday’s close.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-23T12:45:00-04:00 minus 60 minutes through 2026-04-23T12:55:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-23T12:55:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1716 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7097.0; swept/lost=none; recovered=7097.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=actual_setup_level+recovered_level; 7160.0=current_price_context
- Time mentions: none
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\112_accepted_non_acceptance_protocol_20260423_1256_7097.0.svg trap=7079.25 reclaim=2026-04-23T12:53:00-04:00 threshold_hold=19 visual=training_candidate overlap=6
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: A little after the close Tuesday, ES recovered a major low at 7097 (this low held for much of the day Tuesday), initiating a Failed Breakdown in the process. From there, we got the short squeeze to 7160+ Wednesday.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...

### data\research\mancini\The Longer Mancini Logs.txt:1718 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7129.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7180.0
- Level roles: 7160.0=current_price_context; 7105.0=current_price_context; 7129.0=swept_lost_low; 7180.0=target_or_response
- Time mentions: 8pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then Wednesday evening? A little after 8pm we saw a classic Failed Breakdown. Driven by an erroneous headline, ES went elevator down a little after 8pm from 7160’s to 7105. In doing so, ES lost a major low at 7129 from Wednesday morning. Shortly after, that 7129 low recovered, and ES ripped to 7180 by noon Wednesday.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1720 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=7080.0; recovered=7085.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7080.0=swept_lost_low; 7085.0=actual_setup_level+recovered_level; 7185.0=current_price_context
- Time mentions: 1pm, 1:50PM
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Then yesterday? We went elevator down again around 1pm. This elevator down sell took ES rapidly from 7160s at 1pm down to 7080. Shortly after - around 1:50PM - ES recovered the big shelf of lows at 7085 comprising the Sunday and Tuesday lows. This was a big Failed Breakdown, and we ripped from there to 7185+ today.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1732 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: actual_recap
- Levels: setup=none; swept/lost=7129.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7178.0
- Level roles: 7129.0=swept_lost_low; 7178.0=target_or_response
- Time mentions: 3:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: As we will see, around 3:50PM yesterday we swept 7129, recovered, then ripped to ~7178 range resistance by 730AM this morning.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1746 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7129.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7129.0=actual_setup_level
- Time mentions: 3:55PM
- S/R coincidence: 7129.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Thursday Evening and the 3:55PM 7129 Failed Breakdown
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-21T11:43:00-04:00 minus 60 minutes through 2026-04-21T14:12:00-04:00 plus 90 minutes; trap_low=7118.25; reclaim=2026-04-21T14:12:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1750 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=none; swept/lost=7105.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7180.0
- Level roles: 7105.0=swept_lost_low; 7180.0=target_or_response; 7080.0=current_price_context; 7085.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Ranges like this are what I call Mode 2. Mode 2 is easy to trade as long as you follow the rules. 1) Do not predict price action. Do not predict what path price will take to fill out the range, when it will breakout, or how it will breakout. If you try to predict, you’ve lost already. Simply plan triggers, react. 2) Always manage trades level to level. In...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1754 `needs_bigger_crop`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: planned_setup
- Levels: setup=7129.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7129.0=actual_setup_level; 7125.0=current_price_context
- Time mentions: 4pm, 2:55PM
- S/R coincidence: 7129.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 7129. I wrote yesterday at 4pm: “7129 is first proper support down. This is heavily used up today. Instead of buying it directly, at 2:55PM today ES set a nice low at ~7125 from which we bounced 20+ points. Wait for a Failed Breakdown of this low. This is a very low quality long since we are in t...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-21T11:43:00-04:00 minus 60 minutes through 2026-04-21T14:12:00-04:00 plus 90 minutes; trap_low=7118.25; reclaim=2026-04-21T14:12:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1756 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7125.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7125 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1767 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7130.0; invalidation=none; target/response=none
- Level roles: 7125.0=current_price_context; 7130.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7125) by 5 points (7130) and holds at or above 7130 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1769 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: data_context
- Levels: setup=none; swept/lost=7120.0, 7125.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7125.0=swept_lost_low; 7120.0=swept_lost_low; 7130.0=current_price_context; 7138.0=current_price_context; 7133.0=current_price_context; 7143.0=current_price_context
- Time mentions: 3:48PM, 3:50PM, 3:55
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: At 3:48PM, ES swept 7125 down to 7120. By 3:50PM, we recovered. One could long here anywhere above 7130 after price holds that for a few minutes. By 3:55-57PM we had this and one could have longed at 7138 or so which is where price was at the time. No wrong way to do this though. Doesn’t matter if you long at 7133 or 7143 - as long as you think price can ...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1802 `needs_bigger_crop`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: planned_setup
- Levels: setup=7085.0, 7129.0, 7135.0, 7121.0, 7080.0, 6793.0; swept/lost=7074.0, 7180.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7085.0=actual_setup_level; 7129.0=actual_setup_level; 7180.0=swept_lost_low; 7185.0=current_price_context; 7147.0=current_price_context; 7135.0=actual_setup_level; 7121.0=actual_setup_level; 7080.0=actual_setup_level; 7074.0=swept_lost_low; 7058.0=current_price_context
- Time mentions: 8:45PM, 1:50PM, 3:55PM, 2:30PM, 9:40AM, 3:45PM
- S/R coincidence: 7085.0=coincides_cleanly; 7129.0=coincides_cleanly; 7135.0=coincides_cleanly; 7121.0=coincides_cleanly; 7080.0=coincides_cleanly; 6793.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entries wwere the 1:50PM Thursday Failed Breakdown of 7085 and the 3:55PM Thursday Failed Breakdown of 7129. We are closing at the highs today and readers know what I’m going to say here. There...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1806 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7147.0; swept/lost=7080.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7204.0
- Level roles: 7180.0=current_price_context; 7085.0=current_price_context; 7160.0=current_price_context; 7080.0=swept_lost_low; 7204.0=target_or_response; 7224.0=current_price_context; 7242.0=current_price_context; 7259.0=current_price_context; 7147.0=actual_setup_level
- Time mentions: 1:55PM
- S/R coincidence: 7147.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case Monday Bulls remain fully in control. All week ES built a big range 7180 to 7085. Today, we broke it out and now there is nothing to do but hold runner until the next elevator down sell. As always, this massive rally we saw yesterday into today was caused by a classic Failed breakdown at 1:55PM Thursday. ES went elevator down from 7160 down to 7...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-23T12:47:00-04:00 minus 60 minutes through 2026-04-23T13:33:00-04:00 plus 90 minutes; trap_low=7079.75; reclaim=2026-04-23T13:33:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1808 `negative_control`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7147.0=current_price_context; 7133.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case Monday: Begins below 7147. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mastered...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-22, 2026-04-23, 2026-04-24, 2026-04-27

### data\research\mancini\The Longer Mancini Logs.txt:1810 `data_only`

- Context: A Full Week Of Coil For SPX. Do We Trend Next Week? April 27 Pan | pub=2026-04-26 | plan=None
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7085.0=actual_setup_level; 7147.0=current_price_context; 7204.0=current_price_context; 7224.0=current_price_context; 7242.0=current_price_context; 7259.0=current_price_context
- Time mentions: none
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: In summary for tomorrow: Bulls remain fully in control. All week ES built a big range 7180 to 7085. Today, we broke it out and now there is nothing to do but hold runner until the next elevator down sell. This rally was caused by a massive Failed Breakdown of the Sunday/Tuesday shelf of lows at 7085 that we saw yesterday afternoon. My general lean is to d...
- Nearest support context: line 1800: Supports are: 7180 (major), 7166, 7159 (major), 7153, 7147 (major), 7135 (major), 7129, 7121 (major), 7111, 7105 (major), 7095, 7085 (major), 7080, 7074 (major), 7067, 7063, 7058 (major), 7048 (major), 7041, 7036, 7026 (major), 7020, 7016 (major), 7013, 7008 (major), 6999, 6990 (major), 6983, 6975 (major), 6970, 6963, 6956, 6949 (major), 6943, 6938, 6928 ...
- Nearest resistance context: line 1804: Resistances are: 7185, 7193, 7204 (major), 7209, 7218, 7224 (major), 7234, 7242 (major), 7249, 7256 (major), 7261, 7269, 7280 (major), 7294, 7305 (major), 7311, 7316, 7323, 7333 (major), 7342 (major), 7348, 7359, 7365-68 (major), 7377, 7387 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries he...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1826 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: actual_recap
- Levels: setup=7097.0; swept/lost=7085.0, 7097.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7160.0
- Level roles: 7085.0=swept_lost_low; 7097.0=actual_setup_level+swept_lost_low; 7160.0=target_or_response
- Time mentions: 3:40pm, 4pm
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\112_accepted_non_acceptance_protocol_20260423_1256_7097.0.svg trap=7079.25 reclaim=2026-04-23T12:53:00-04:00 threshold_hold=19 visual=training_candidate overlap=10
- Blockers: chart_trap_low_7079.25_mismatch_stated_sweep_7085.0
- Source: Last night towards the close, we saw this dynamic again. We sold down to 7085. In doing so, ES lost the 7097 low which held much of the day yesterday. I wrote yesterday at 3:40pm: “Instead the much safer entry is to wait for a Failed Breakdown of today’s low which is at 7097. Let that flush and recover.” A little after 4pm yesterday, we recovered this and...
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:1828 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7085.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: As I discussed yesterday, heading into today ES was rangebound printing a large, sideways flag on the chart mostly 7180 to 7085 now. Is it ready to break? In today’s newsletter I’ll expand on this, I’ll go over today’s Failed Breakdowns (these are key to know), and I’ll discuss the actionable plan for tomorrow.
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24

### data\research\mancini\The Longer Mancini Logs.txt:1862 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: context_recap
- Levels: setup=7120.0, 6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7120.0=actual_setup_level
- Time mentions: 4pm, 8:45PM, 1:40PM
- S/R coincidence: 7120.0=coincides_cleanly; 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 1:40PM Failed Breakdown of 7120, discussed above.”
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24

### data\research\mancini\The Longer Mancini Logs.txt:1868 `needs_bigger_crop`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: actual_recap
- Levels: setup=7120.0; swept/lost=7085.0; recovered=7120.0; non_acceptance=none; invalidation=none; target/response=7180.0
- Level roles: 7160.0=current_price_context; 7085.0=swept_lost_low; 7120.0=actual_setup_level+recovered_level; 7180.0=target_or_response
- Time mentions: 6pm, 9:45AM
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this off the Sunday open this week. We went elevator down from 7160 and flushed to 7085 at 6pm Sunday evening. Shortly after, ES recovered a massive low set at 9:45AM on Friday at 7120 (Failed Breakdown) and rallied to 7180’s yesterday before finally going elevator down yesterday morning ultimately back to 7085 by yesterday’s close.
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: render ES 1m from 2026-04-23T12:45:00-04:00 minus 60 minutes through 2026-04-23T12:55:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-23T12:55:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1870 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: context_recap
- Levels: setup=7097.0; swept/lost=none; recovered=7097.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=actual_setup_level+recovered_level; 7147.0=current_price_context
- Time mentions: none
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\112_accepted_non_acceptance_protocol_20260423_1256_7097.0.svg trap=7079.25 reclaim=2026-04-23T12:53:00-04:00 threshold_hold=19 visual=training_candidate overlap=6
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: A little after the close yesterday, ES recovered a major low at 7097 (this low held for much of the day yesterday), initiating a Failed Breakdown in the process. From there, we got the short squeeze to 7147+ into today.
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:1880 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: data_context
- Levels: setup=none; swept/lost=7097.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7202.0
- Level roles: 7100.0=current_price_context; 7180.0=current_price_context; 7120.0=current_price_context; 7147.0=current_price_context; 7097.0=swept_lost_low; 7202.0=target_or_response; 7220.0=current_price_context; 7235.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: After spending Friday and last week rallying almost non-stop, ES is finally back into consolidation mode and has spent all week building a new, large, constantly morphing consolidation. This will (like all ranges) constantly morph but as of now is something like 7100-05 to 7180 with 7120 being a major magnet in the middle of the range, as well as 7147. As...
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24

### data\research\mancini\The Longer Mancini Logs.txt:1882 `needs_bigger_crop`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: actual_recap
- Levels: setup=7097.0; swept/lost=7085.0, 7097.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=actual_setup_level+swept_lost_low; 7085.0=swept_lost_low
- Time mentions: 3:50PM
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Around 3:50PM yesterday, ES flushed yesterday’s 7097 low (this was a big low that held most the session) down to 7085 and recovered for a Failed Breakdown from which we ripped back up into that range.
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: render ES 1m from 2026-04-21T14:44:00-04:00 minus 60 minutes through 2026-04-21T14:47:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-21T14:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1896 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: context_recap
- Levels: setup=7097.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=actual_setup_level
- Time mentions: 4:07PM
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The Tuesday 4:07PM Failed Breakdown of 7097
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: render ES 1m from 2026-04-21T14:44:00-04:00 minus 60 minutes through 2026-04-21T14:47:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-21T14:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1904 `needs_bigger_crop`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: planned_setup
- Levels: setup=7097.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=actual_setup_level; 7105.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 7097.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 7097. I wrote yesterday at 4pm: “Instead the much safer entry is to wait for a Failed Breakdown of today’s low which is at 7097. Let that flush and recover. Ideally here wait for 7105 to clear before entry though (this is where the non-acceptance protocol entry would be anyway).”
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: render ES 1m from 2026-04-21T14:44:00-04:00 minus 60 minutes through 2026-04-21T14:47:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-21T14:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:1906 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7097.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7097 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24

### data\research\mancini\The Longer Mancini Logs.txt:1917 `data_only`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7105.0; invalidation=none; target/response=none
- Level roles: 7097.0=current_price_context; 7105.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\114_accepted_non_acceptance_protocol_20260423_1256_7105.0.svg trap=7079.25 reclaim=2026-04-23T12:53:00-04:00 threshold_hold=19 visual=insufficient_visual_context overlap=10
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7097) by 5 points (7105) and holds at or above 7105 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:1952 `needs_bigger_crop`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: planned_setup
- Levels: setup=7058.0, 6793.0, 7097.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7097.0=actual_setup_level; 7180.0=current_price_context; 7085.0=current_price_context; 7147.0=current_price_context; 7111.0=current_price_context; 7129.0=current_price_context; 7058.0=actual_setup_level
- Time mentions: 8:45PM, 4:07PM, 4pm, 12:50PM, 1:10AM
- S/R coincidence: 7058.0=coincides_partially; 6793.0=coincides_cleanly; 7097.0=coincides_partially
- Chart/window: multi-level split required; local matches by level only: 7097.0:artifacts\research\mancini-real-packet-gallery\112_accepted_non_acceptance_protocol_20260423_1256_7097.0.svg visual=training_candidate
- Blockers: multi_setup_row_split_required, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 4:07PM 7097 Failed Breakdown yesterday, discussed above. Heading into tomorrow, little has changed in ES. We remain inside a clear range which has been building since Friday. Resi...
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...

### data\research\mancini\The Longer Mancini Logs.txt:1958 `negative_control`

- Context: SPX Continues To Coil Tighter. Is A Breakout Close? April 23rd Plan | pub=2026-04-22 | plan=2026-04-23
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7111.0=current_price_context; 7099.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7111. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 1950: Supports are: 7147 (major), 7134, 7129 (major), 7120, 7111-08 (major), 7093, 7086 (major), 7072 (major), 7063, 7057 (major), 7048, 7041, 7036 (major), 7030, 7026 (major), 7020, 7016 (major), 7007, 7002 (major), 6990, 6983 (major), 6970, 6960 (major), 6955, 6949 (major), 6943, 6938, 6927, 6920 (major), 6908, 6903 (major), 6887, 6883 (major), 6880, 6872 (ma...
- Nearest resistance context: line 1954: Resistances are: 7147 (major), 7154, 7160 (major), 7166, 7175, 7180 (major), 7184, 7192, 7200 (major), 7206, 7216 (major), 7220, 7235 (major), 7243, 7249, 7258, 7263, 7280 (major), 7285, 7291, 7300 (major), 7306, 7310, 7320, 7330 (major), 7336, 7344, 7348, 7353 (major), 7357, 7363 (major). As readers know I don’t short ES - I only get my points on the lon...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23, 2026-04-24

### data\research\mancini\The Longer Mancini Logs.txt:1976 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7180.0=current_price_context; 7100.0=current_price_context; 7085.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Heading into today, we were rangebound and ES is printing a large, sideways flag on the chart mostly 7180 to 7100-05/7085 now. Will this breakout yet again?In today’s newsletter I’ll expand on this, I’ll go over today’s Failed Breakdowns (these are key to know), and I’ll discuss the actionable plan for tomorrow.
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2010 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=7120.0, 6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7120.0=actual_setup_level
- Time mentions: 4pm, 8:45PM, 9:20PM
- S/R coincidence: 7120.0=coincides_cleanly; 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 9:20PM this Sunday Failed Breakdown of 7120, discussed below. ”
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2018 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=6760.0; recovered=6793.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6860.0=current_price_context; 6793.0=actual_setup_level+recovered_level; 7184.0=current_price_context
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: What happened? Sunday evening April 12th we gapped down from 6860’s and went elevator down to 6760s. Sentiment was max bearish here, influencer accounts were posting charts with big red arrows down. As always - they would end up as fodder for institutions and this sell would resolve with a short squeeze, but only when we get a Failed Breakdown. At around ...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2020 `needs_bigger_crop`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: actual_recap
- Levels: setup=7120.0; swept/lost=7085.0; recovered=7120.0; non_acceptance=none; invalidation=none; target/response=7160.0
- Level roles: 7085.0=swept_lost_low; 7120.0=actual_setup_level+recovered_level; 7160.0=target_or_response; 7180.0=current_price_context
- Time mentions: 6pm, 9:45AM
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Then off the Sunday open this week? The cycle continues. We went elevator down and flushed to 7085 at 6pm Sunday evening. Shortly after, ES recovered a massive low set at 9:45AM on Friday at 7120 (Failed Breakdown) and rallied to 7160 yesterday then further to 7180’s this morning.
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-23T12:45:00-04:00 minus 60 minutes through 2026-04-23T12:55:00-04:00 plus 90 minutes; trap_low=7085.0; reclaim=2026-04-23T12:55:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2030 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7160.0
- Level roles: 7147.0=current_price_context; 7085.0=actual_setup_level; 7120.0=current_price_context; 7160.0=target_or_response; 7174.0=current_price_context; 7194.0=current_price_context; 7217.0=current_price_context
- Time mentions: 6pm
- S/R coincidence: 7085.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: Very simple. After a massive rally Friday, ES is consolidating and this range is roughly 7147-53 (this has been resistance all day) to 7085 (this is where we bottomed out at 6pm last evening). 7085 was a resistance shelf on Thursday that broke out Friday morning and exploded us upwards. Inside this range, 7120 is a key mid-pivot that a...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-23T12:46:00-04:00 minus 60 minutes through 2026-04-23T12:47:00-04:00 plus 90 minutes; trap_low=7079.25; reclaim=2026-04-23T12:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2046 `needs_bigger_crop`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: planned_setup
- Levels: setup=7120.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: Monday Evening and the Possible 7120 Failed Breakdown
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2048 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7140.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We closed up yesterday near the highs again in the 7140’s and as always, there is little to do but wait patiently for an elevator down sell and Failed Breakdown.
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2052 `needs_bigger_crop`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: planned_setup
- Levels: setup=7120.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7147.0
- Level roles: 7120.0=actual_setup_level; 7121.0=current_price_context; 7147.0=target_or_response
- Time mentions: 4pm, 11am
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 7120. I wrote yesterday at 4pm: “Below there is 7121. There is a massive shelf of lows at 7121. Specifically at 11am we set a huge low there and rallied to 7147+. At 730AM, we set another low there and rallied 37+ points. This is a clear zone we’d want to trade the flush and recovery of and a Fai...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2054 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7120 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2056 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=current_price_context
- Time mentions: 11am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 7120 we had #3: A shelf of lows. Specifically, at 730am and 11am yesterday ES set big lows at 7120 from which we rallied 37 and 30 points respectively. The flush and recovery here is actionable.
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2065 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7125.0; invalidation=none; target/response=none
- Level roles: 7120.0=current_price_context; 7125.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\098_accepted_non_acceptance_protocol_20260421_1009_7125.0.svg trap=7120.75 reclaim=2026-04-21T10:06:00-04:00 threshold_hold=18 visual=training_candidate overlap=19
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7120) by 5 points (7125) and holds at or above 7125 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...

### data\research\mancini\The Longer Mancini Logs.txt:2080 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=7120.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=actual_setup_level
- Time mentions: 11am
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 11am Elevator Down Sell into ~7120 Failed Breakdown
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2084 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=7120.0; swept/lost=7120.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=actual_setup_level+swept_lost_low; 7121.75=current_price_context; 7121.5=current_price_context
- Time mentions: 11:04AM, 11am
- S/R coincidence: 7120.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: By 11:04AM, we hit 7120 support. In the above section, I discussed the 7120 Failed Breakdown long. This one was abit awkward because we really need to get into precise levels to see the Failed Breakdown here. To be extremely precise, the 730am and 11am lows yesterday were at 7121.75 and 7121.50 respectively. Since we flushed to 7120 then recovered those 7...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2086 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7130.0=current_price_context; 7135.0=current_price_context
- Time mentions: 11am, 11:06AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Right after 11am, we recovered that shelf and I took the long here via the non-acceptance protocol, longing at 11:06AM at 7130 or so this is where we were at the time. I managed this as always: Locked in 75% profits at 7135 1st up, left 25% to run. We finally had some volatility pick up here at least and the last two weeks have offered barely any trades. ...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2111 `needs_bigger_crop`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: planned_setup
- Levels: setup=7120.0, 7097.0, 7085.0, 6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7120.0=actual_setup_level; 7100.0=current_price_context; 7180.0=current_price_context; 7147.0=current_price_context; 7110.0=current_price_context; 7097.0=actual_setup_level; 7105.0=current_price_context; 7085.0=actual_setup_level; 7058.0=current_price_context; 7021.0=current_price_context
- Time mentions: 8:45PM, 1:40PM, 2:30PM
- S/R coincidence: 7120.0=coincides_cleanly; 7097.0=coincides_partially; 7085.0=coincides_cleanly; 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 1:40PM Failed Breakdown of 7120, discussed above. After spending Friday and last week rallying almost non-stop, ES is finally back into consolidation mode and has spent all week b...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2115 `data_only`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: context_recap
- Levels: setup=none; swept/lost=7097.0; recovered=none; non_acceptance=none; invalidation=none; target/response=7202.0
- Level roles: 7180.0=current_price_context; 7100.0=current_price_context; 7120.0=current_price_context; 7147.0=current_price_context; 7097.0=swept_lost_low; 7202.0=target_or_response; 7220.0=current_price_context; 7235.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Very simple. After a massive rally Friday, ES is consolidating and this range is now roughly 7180 resistance (you can connect a trendline through the Friday high and today’s high here) and 7100-05 support (this was a big support most of today). Inside this range, 7120 and 7147 are major pivots. The bull case is that ES can fill this ra...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2117 `negative_control`

- Context: After 3 Weeks of Upside, SPX Is Coiled. Another Breakout Coming? April 22nd Plan | pub=2026-04-21 | plan=2026-04-22
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7100.0=current_price_context; 7095.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 7100-05. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mas...
- Nearest support context: line 2109: Supports are: 7127, 7120 (major), 7110, 7100-05 (major), 7095, 7085 (major), 7082, 7082, 7075 (major), 7067, 7057 (major), 7053, 7048 (major), 7040 (major), 7036, 7030, 7025, 7021 (major), 7014, 7008, 7002 (major), 6990 (major), 6984, 6971, 6963, 6955, 6942 (major), 6938, 6928, 6915-20 (major), 6907, 6903, 6889 (major), 6882, 6872 (major), 6867, 6862, 685...
- Nearest resistance context: line 2113: Resistances are: 7134, 7147 (major), 7153, 7165, 7171, 7180 (major), 7185, 7196, 7202 (major), 7212, 7220 (major), 7226, 7235-38 (major), 7245, 7251, 7262 (major), 7274, 7282, 7290 (major), 7294, 7300 (major), 7306, 7312, 7317, 7323 (major), 7331, 7339, 7347 (major), 7351, 7359 (major), 7362, 7374 (major). As readers know I don’t short ES - I only get my ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22, 2026-04-23

### data\research\mancini\The Longer Mancini Logs.txt:2133 `needs_bigger_crop`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=6780.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6760.0=swept_lost_low; 6780.0=actual_setup_level+recovered_level; 6882.0=current_price_context; 6902.0=current_price_context; 6937.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6780.0=does_not_coincide
- Chart/window: none
- Blockers: no_existing_chart_window_match, setup_level_does_not_coincide_with_sr_or_prose_context
- Source: We saw this dynamic right off the Sunday open last week on April 12th. ES gapped down ~70 points Sunday April 12th to 6760’s, sentiment was max bearish, retail was chasing short. I wrote on Friday April 10th at 4pm: “6780 is below there. This was Wednesday’s low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.” ES f...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2135 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7075.0=current_price_context; 7093.0=current_price_context; 7131.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I knew however that this run was just getting started because not only did we see that big Failed Breakdown Sunday, but readers recall last Tuesday April 14th, ES broke out from a month long bull flag (shown in white below). I wrote at 4pm Thursday: “My general lean is always to defer to the trend until evidence tells me otherwise. 7075, 7093, 7131 are ne...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2173 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level
- Time mentions: 4pm, 8:45PM
- S/R coincidence: 6793.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close Friday at 4pm: “I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th.
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2181 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=6760.0; recovered=6793.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6860.0=current_price_context; 6793.0=actual_setup_level+recovered_level; 7184.0=current_price_context
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: What happened? Sunday evening April 12th we gapped down from 6860’s and went elevator down to 6760s. Sentiment was max bearish here, influencer accounts were posting charts with big red arrows down. As always - they would end up as fodder for institutions and this sell would resolve with a short squeeze, but only when we get a Failed Breakdown. At around ...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2183 `needs_bigger_crop`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: actual_recap
- Levels: setup=7120.0; swept/lost=7085.0; recovered=7120.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=swept_lost_low; 7120.0=actual_setup_level+recovered_level
- Time mentions: 6pm, 9:45AM
- S/R coincidence: 7120.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Then off the Sunday open? The cycle continues. We went elevator down and flushed to 7085 at 6pm last night. Shortly after, ES recovered a massive low set at 9:45AM on Friday at 7120 (Failed Breakdown) and rallied.
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: render ES 1m from 2026-04-17T02:13:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7084.75; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2193 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=7153.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7058.0=current_price_context; 7049.0=current_price_context; 7186.0=current_price_context; 7192.0=current_price_context; 7217.0=current_price_context; 7230.0=current_price_context; 7153.0=actual_setup_level; 7120.0=current_price_context
- Time mentions: 7am
- S/R coincidence: 7153.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: I’ve discussed this at enormous length but sells in ES only occur when a major, well tested, previously defended support shelf fails OR ES fails back into a previously broken out structure. Until then, there is no technical basis for any selloff. Right now, the most nearby structure is a bull flag from noon Thursday until 7am this morn...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: render ES 1m from 2026-04-17T03:11:00-04:00 minus 60 minutes through 2026-04-17T09:10:00-04:00 plus 90 minutes; trap_low=7085.75; reclaim=2026-04-17T09:10:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2219 `needs_bigger_crop`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: planned_setup
- Levels: setup=7120.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=actual_setup_level
- Time mentions: 4pm
- S/R coincidence: 7120.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible quality entry was down was a Failed Breakdown of 7120. I wrote Friday at 4pm:
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2221 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7153.0=current_price_context; 7120.0=current_price_context
- Time mentions: 9:45AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Below 7153 is 7120. Again, not interested in buying this - however - at 9:45AM today ES set a massive low there from which ES rallied 67 points to the high of day. A failed breakdown of this low would be actionable for a level to level move
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2223 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7120 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2234 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7125.0; invalidation=none; target/response=none
- Level roles: 7120.0=current_price_context; 7125.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\098_accepted_non_acceptance_protocol_20260421_1009_7125.0.svg trap=7120.75 reclaim=2026-04-21T10:06:00-04:00 threshold_hold=18 visual=training_candidate overlap=19
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7120) by 5 points (7125) and holds at or above 7125 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...

### data\research\mancini\The Longer Mancini Logs.txt:2240 `needs_bigger_crop`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: planned_setup
- Levels: setup=7120.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7120.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7120.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: Again, I opted to wait for the Failed Breakdown of 7120. Here, we had the first type of acceptance. Remember the first form price back-tests the significant low from below, sells off, then returns to it. By doing this (selling off at the significant low then rebounding back to it), price tells us there is no supply at the significant low and we can safetl...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: render ES 1m from 2026-04-17T01:49:00-04:00 minus 60 minutes through 2026-04-17T07:48:00-04:00 plus 90 minutes; trap_low=7081.25; reclaim=2026-04-17T07:48:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2277 `needs_bigger_crop`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: planned_setup
- Levels: setup=7120.0, 6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7147.0
- Level roles: 6793.0=actual_setup_level; 7120.0=actual_setup_level; 7147.0=target_or_response; 7085.0=current_price_context; 7135.0=current_price_context; 7121.0=current_price_context; 7110.0=current_price_context; 7104.0=current_price_context; 7058.0=current_price_context
- Time mentions: 8:45PM, 9:20PM, 2pm, 11am, 6pm, 2:10PM
- S/R coincidence: 7120.0=coincides_partially; 6793.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday April 12th in the evening. My most recent entry was the 9:20PM this Sunday Failed Breakdown of 7120, discussed above. Today was finally a rest day for ES after Friday’s non-stop upside and ES began building a sideways consolidation. Ge...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2281 `data_only`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: context_recap
- Levels: setup=7085.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7160.0
- Level roles: 7147.0=current_price_context; 7085.0=actual_setup_level; 7120.0=current_price_context; 7160.0=target_or_response; 7174.0=current_price_context; 7194.0=current_price_context; 7217.0=current_price_context
- Time mentions: 6pm
- S/R coincidence: 7085.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: Very simple. After a massive rally Friday, ES is consolidating and this range is roughly 7147-53 (this has been resistance all day) to 7085 (this is where we bottomed out at 6pm last evening). 7085 was a resistance shelf on Thursday that broke out Friday morning and exploded us upwards. Inside this range, 7120 is a key mid-pivot that a...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: render ES 1m from 2026-04-16T05:01:00-04:00 minus 60 minutes through 2026-04-16T11:00:00-04:00 plus 90 minutes; trap_low=7068.75; reclaim=2026-04-16T11:00:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2283 `negative_control`

- Context: Bulls Bought The Dip Again In SPX. Are More New Highs Coming? April 21 Plan | pub=2026-04-20 | plan=2026-04-21
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7074.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins under 7085. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 2275: Supports are: 7148, 7135 (major), 7126, 7121 (major), 7110, 7104 (major), 7095, 7086 (major), 7078 (major), 7074, 7067, 7057 (major), 7053, 7049 (major), 7041, 7036 (major), 7031, 7026, 7021, 7014 (major), 7009, 7003 (major), 6993, 6983 (major), 6967, 6963 (major), 6958, 6948, 6944, 6938 (major), 6928 (major), 6923, 6916 (major), 6908, 6903 (major), 6893,...
- Nearest resistance context: line 2279: Resistances are: 7153 (major), 7159, 7169, 7174 (major), 7186, 7194 (major), 7204, 7217 (major), 7224, 7232 (major), 7239, 7245, 7253 (major), 7262, 7271, 7283 (major), 7290 (major), 7304, 7314, 7318 (major), 7330, 7341 (major), 7352, 7358 (major), 7362, 7369 (major). As readers know I don’t short ES - I only get my points on the long side, but I still gi...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-16, 2026-04-17, 2026-04-20, 2026-04-21, 2026-04-22

### data\research\mancini\The Longer Mancini Logs.txt:2302 `needs_bigger_crop`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=6780.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6760.0=swept_lost_low; 6780.0=actual_setup_level+recovered_level; 6882.0=current_price_context; 6902.0=current_price_context; 6937.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6780.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: We saw this dynamic right off the Sunday open this week. ES gapped down Sunday to 6760’s, sentiment was max bearish, retail was chasing short. I wrote on Friday at 4pm: “6780 is below there. This was Wednesday’s low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.” ES flushed to 6760’s Sunday evening, recovered 6780...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2304 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6983.0=current_price_context; 7021.0=current_price_context; 7036.0=current_price_context; 7048.0=current_price_context; 7058.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I knew however that this run was just getting started because not only did we see that big Failed Breakdown Sunday, but readers recall last Tuesday, ES broke out from a month long bull flag (shown in white below). On Tuesday at 4pm, I was looking for more, “My general lean is to defer to the trend. 6983 (watch traps) is support tomorrow. It keeps 7021, 70...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2342 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7056.0=current_price_context
- Time mentions: 4pm, 8:45PM, 10:45AM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I verified my positioning at the close yesterday at 4pm: “I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday evening. My most recent entry was the 10:45AM 7056 low quality Failed Breakdown, discussed above. “
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: render ES 1m from 2026-04-12T18:00:00-04:00 minus 60 minutes through 2026-04-12T19:47:00-04:00 plus 90 minutes; trap_low=6776.5; reclaim=2026-04-12T19:47:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2350 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=6760.0; recovered=6793.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6860.0=current_price_context; 6793.0=actual_setup_level+recovered_level; 7184.0=current_price_context
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: What happened? Sunday evening April 12th we gapped down from 6860’s and went elevator down to 6760s. Sentiment was max bearish here, influencer accounts were posting charts with big red arrows down. As always - they would end up as fodder for institutions and this sell would resolve with a short squeeze, but only when we get a Failed Breakdown. At around ...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2360 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=7075.0
- Level roles: 7048.0=current_price_context; 6716.0=current_price_context; 6983.0=current_price_context; 7075.0=target_or_response; 6758.0=current_price_context; 6773.0=current_price_context; 6748.0=current_price_context; 7086.0=current_price_context; 7093.0=current_price_context; 7103.0=current_price_context; 7116.0=current_price_context; 7131.0=current_price_context
- Time mentions: 6pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: I’ve discussed this at enormous length but sells in ES only occur when a major, well tested, previously defended support shelf fails. Until then, there is no technical basis for any selloff. ES will need to lose 7048 (today’s low) at minimum to start this. Generally, the bull case tomorrow though is that ES can simply flag out then con...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2376 `needs_bigger_crop`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: planned_setup
- Levels: setup=7058.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7058.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 7058.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: Thursday Evening and the possible 7058 Failed Breakdown
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: render ES 1m from 2026-04-16T09:23:00-04:00 minus 60 minutes through 2026-04-16T09:45:00-04:00 plus 90 minutes; trap_low=7047.75; reclaim=2026-04-16T09:45:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2384 `needs_bigger_crop`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: planned_setup
- Levels: setup=7058.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7058.0=actual_setup_level; 7048.0=current_price_context; 7041.0=current_price_context
- Time mentions: 4pm, 1:10PM, 2:20PM
- S/R coincidence: 7058.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 7058. I wrote yesterday at 4pm: “First support as of writing though is 7058. We set two small lows there today one at 1:10PM and one at 2:20PM. Instead of buying this directly, its best to wait for that shelf of lows to flush and recover as a Failed Breakdown. 7048 is below there. This is where w...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: render ES 1m from 2026-04-16T09:23:00-04:00 minus 60 minutes through 2026-04-16T09:45:00-04:00 plus 90 minutes; trap_low=7047.75; reclaim=2026-04-16T09:45:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2386 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7058.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 7058 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2397 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=7063.0; invalidation=none; target/response=none
- Level roles: 7058.0=current_price_context; 7063.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (7058) by 5 points (7063) and holds at or above 7063 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2418 `needs_bigger_crop`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: planned_setup
- Levels: setup=7104.0, 6793.0; swept/lost=7147.0, 7153.0, 7085.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level; 7056.0=current_price_context; 7153.0=swept_lost_low; 7147.0=swept_lost_low; 7120.0=current_price_context; 7104.0=actual_setup_level; 7085.0=swept_lost_low; 7058.0=current_price_context
- Time mentions: 8:45PM, 10:45AM, 1:20PM, 9:45AM, 7am
- S/R coincidence: 7104.0=coincides_cleanly; 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 6793 Failed Breakdown at 8:45PM Sunday evening. My most recent entry was the 10:45AM 7056 low quality Failed Breakdown yesterday. This has been a staggering 315 point runner this week and one of the best this year. Despite this though readers know that I am a long only trad...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2422 `data_only`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: context_recap
- Levels: setup=7153.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7085.0=current_price_context; 7058.0=current_price_context; 7049.0=current_price_context; 7186.0=current_price_context; 7192.0=current_price_context; 7217.0=current_price_context; 7230.0=current_price_context; 7153.0=actual_setup_level; 7120.0=current_price_context
- Time mentions: 7am
- S/R coincidence: 7153.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Bull case tomorrow: I’ve discussed this at enormous length but sells in ES only occur when a major, well tested, previously defended support shelf fails OR ES fails back into a previously broken out structure. Until then, there is no technical basis for any selloff. Right now, the most nearby structure is a bull flag from noon Thursday until 7am this morn...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: render ES 1m from 2026-04-17T03:11:00-04:00 minus 60 minutes through 2026-04-17T09:10:00-04:00 plus 90 minutes; trap_low=7085.75; reclaim=2026-04-17T09:10:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2424 `negative_control`

- Context: 5 Parabolic Green Days In A Row For SPX. Will SPX Pullback Next Week? April 18 Plan | pub=2026-04-19 | plan=2026-04-18
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7049.0=current_price_context; 7120.0=current_price_context; 7116.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear Case Monday: Ultimately 7049 must fail which is a ways down. There is a high risk short available below 7120 though. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. T...
- Nearest support context: line 2416: Supports are: 7160, 7153 (major), 7147 (major), 7139, 7135, 7128, 7120 (major), 7109, 7104 (major), 7099, 7096, 7085 (major), 7078, 7074 (major), 7067, 7062, 7058 (major), 7052, 7048 (major), 7041, 7035, 7026, 7015-7020 (major), 7008, 7003, 6993, 6982 (major), 6975, 6968, 6963 (major), 6954, 6950 (major), 6939, 6930 (major), 6921 (major), 6908, 6903 (majo...
- Nearest resistance context: line 2420: Resistances are: 7166, 7175 (major), 7186, 7192 (major), 7200, 7207, 7217 (major), 7230 (major), 7235, 7240, 7257, 7267, 7277 (major), 7287, 7291, 7300 (major), 7313 (major), 7324, 7334 (major), 7342, 7350 (major), 7361 (major). As readers know I don’t short ES - I only get my points on the long side, but I still give short entries here for those who like...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-14, 2026-04-15, 2026-04-16, 2026-04-17, 2026-04-20

### data\research\mancini\The Longer Mancini Logs.txt:2440 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6353.0=swept_lost_low; 6360.0=current_price_context; 6662.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw it Monday March 30th as stated and this was a major accumulation event as institutions prepped for what ended up being a 480 point leg up - as always, we followed them: ES plunged to 6353 Monday March 30th in evening going elevator down. In doing so, we swept a shelf of lows from Sunday March 29th/Monday March 30th at 6360. I wrote Monday March 30t...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2444 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=6780.0; non_acceptance=none; invalidation=none; target/response=6880.0
- Level roles: 6780.0=actual_setup_level+recovered_level; 6760.0=swept_lost_low; 6880.0=target_or_response; 6882.0=current_price_context; 6902.0=current_price_context; 6937.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6780.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: After a big rally like this, bulls had to rest, and (as always) buy the next dip via a Failed Breakdown. That dip came off the open last night. I wrote on Friday at 4pm: “6780 is below there. This was yesterday’s (Wednesday’s) low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.” ES flushed to 6760’s last evening, r...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2481 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6595.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6595.0=actual_setup_level
- Time mentions: 11:15AM
- S/R coincidence: 6595.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 11:15AM 6595 Failed Breakdown we saw Tuesday, discussed in Tuesday’s newsletter. I verified this at the close yesterday, stating: “ I am still holding my 10% long runner from the 11:15AM 6595 Failed Breakdown, discussed above.”
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2489 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6595.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0
- Level roles: 6572.0=current_price_context; 6595.0=actual_setup_level; 6647.0=target_or_response; 6850.0=current_price_context
- Time mentions: 11am, 11:15PM
- S/R coincidence: 6595.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: We went elevator down nearly 100 points to 6572 by 11am Tuesday. Shortly after, we put in a Failed Breakdown of 6595 (at 11:15PM on Sunday April 5th ES put in a large bounce at 6595 to 6560s making it a clear significant low of the sort we would want to trade a loss and recovery of) and we ripped to 6647+ after to set the high of day for Tuesday’s regular...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2491 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=6788.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6780.0=current_price_context; 6788.0=swept_lost_low; 6873.0=current_price_context; 6880.0=current_price_context
- Time mentions: 10:40AM, 11am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then last Wednesday? Similar drill. ES went elevator down from 6850 to 6780 by 10:40AM. In doing so, ES lost a big low set at 6788 at 830PM Tuesday evening. This low recovered by 11am Wednesday (Failed Breakdown) and that Failed Breakdown maintained strength to 6873+ into Thursday which then pressed further into 6880’s on Friday.
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2493 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6793.0; swept/lost=none; recovered=6793.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level+recovered_level; 6900.0=current_price_context
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: From there? Gap down/Elevator down Sunday to 6760s. As always, this would resolve with a short squeeze, but only when we get a Failed Breakdown. As I will discuss below, at around 8:45PM last evening ES recovered a 5-touch shelf of lows at 6793 from last Wednesday/Thursday, and we ripped from there to 6900+ today.
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-08T09:56:00-04:00 minus 60 minutes through 2026-04-08T09:59:00-04:00 plus 90 minutes; trap_low=6780.0; reclaim=2026-04-08T09:59:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2501 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6360.0; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0, 6880.0
- Level roles: 6360.0=actual_setup_level; 6353.0=swept_lost_low; 6647.0=target_or_response; 6662.0=current_price_context; 6582.0=current_price_context; 6872.0=current_price_context; 6848.0=current_price_context
- Time mentions: 8:30PM
- S/R coincidence: 6360.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: 2) The basic theme heading into today was that Monday March 30th at 8:30PM ES put in a monster Failed Breakdown at the 6360 level. All major rallies and institutional accumulation events start this way, and last weeks was no different. We had a shelf of lows there (Sunday’s March 29 low & Monday’s March 30th regular hours low) at 6360. We flushed that she...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2503 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=current_price_context; 6848.0=current_price_context; 6780.0=actual_setup_level; 6793.0=current_price_context; 6900.0=current_price_context
- Time mentions: 6pm, 10am
- S/R coincidence: 6780.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Last evening, this tight 6872-6848 range broke down off the Sunday 6pm open due to Iran non-deal headlines and we sold off down to 6760s. Since we gapped lower and had to stalk Failed Breakdown’s which I discuss in more detail below. As we will see, ES put in a huge Failed Breakdown of the 6780/6793 low/shelf of lows last week. By 10am today, we ripped to...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2517 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6848.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Sunday Evening, the Gap Down, and the un-triggered 6848 Failed Breakdown
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T04:54:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6800.5; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2525 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6848.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level
- Time mentions: 12:45PM
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: My most recent entry was the 12:45PM mini Failed Breakdown of 6848 we saw today. This Tuesday long evolved into a 280+ point long. This was an incredibly low volatility, slow session in ES. As I’ve said many times, we need volatility to trade. Trading without volatility is like driving a car without gas - it just won’t go anywhere. Many of my followers ar...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T04:54:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6800.5; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2529 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6848.0; swept/lost=6840.0, 6847.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level; 6847.0=swept_lost_low; 6840.0=swept_lost_low
- Time mentions: 4pm, 12:40PM
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 6848-52. I wrote on Friday at 4pm: “6848-52 is first support down and this has been tested 5x in the last 24hrs with one small flush today. I would not engage this zone again as it is too well tested, but if we can flush today’s 6847 low (perhaps down to 6840) and recover, this would be an action...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T10:42:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6839.0; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2531 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 6848-52 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2533 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context
- Time mentions: 1:40PM, 12:40PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 6848-52 we had #2: A clear cluster or shelf of lows. Specifically between 1:40PM Thursday and 12:40PM Friday ES put in a clear 5 touch shelf of lows there. The flush and recovery of this shelf would b...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2542 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6853.0; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context; 6853.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (6848) by 5 points (6853) and holds at or above 6853 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2544 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 8:45PM 6793 Failed Breakdown
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-08T09:56:00-04:00 minus 60 minutes through 2026-04-08T09:59:00-04:00 plus 90 minutes; trap_low=6780.0; reclaim=2026-04-08T09:59:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2548 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6780.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote Friday at 4pm: “6780 is below there. This was yesterday’s (Wednesday’s) low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.”
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2555 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6770.0, 6780.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6780.0=swept_lost_low; 6793.0=current_price_context; 6770.0=swept_lost_low
- Time mentions: 6pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why 6780 and 6793? Specifically, 6780 (as stated) was last Wednesday’s low of day from which we rallied 105 points. The flush and recovery of this would be actionable per the above criteria. At 6pm we flushed 6780 down to 6770.
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2571 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6830.0
- Level roles: 6830.0=target_or_response
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When I woke up and checked price at 730AM, I was happy to see the long had paid nicely and we ran to 6830’s overnight. From here, there is little for me to do but hold my runner and do nothing. I did my job and my job is clear and simple: I wait for an elevator down sell to produce a Failed Breakdown, I manage level to level, then I stop trading and hold ...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2590 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6793.0, 6765.0, 6595.0, 6851.0; swept/lost=6868.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6595.0=actual_setup_level; 6793.0=actual_setup_level; 6872.0=current_price_context; 6868.0=swept_lost_low; 6861.0=current_price_context; 6848.0=current_price_context; 6851.0=actual_setup_level; 6818.0=current_price_context; 6802.0=current_price_context; 6775.0=current_price_context; 6765.0=actual_setup_level
- Time mentions: 11:15AM, 8:45PM, 8am
- S/R coincidence: 6793.0=coincides_cleanly; 6765.0=coincides_cleanly; 6595.0=coincides_partially; 6851.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 11:15AM 6595 Failed Breakdown last Tuesday. My most recent entry was the 6793 Failed Breakdown at 8:45PM last evening, discussed above. Bulls bought the dip last night and they bought the dip the same way they always do: Via a Failed Breakdown of 6793. Readers shouldn’t be ...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2596 `negative_control`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=current_price_context; 6848.0=current_price_context; 6844.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: 6793 must fail, for those who want a more aggressive, high risk short 6848 failure is a possible short. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally....
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2598 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=6793.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=swept_lost_low; 6872.0=current_price_context; 6903.0=current_price_context; 6923.0=current_price_context; 6930.0=current_price_context; 6949.0=current_price_context; 6978.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: The long keeps paying. Last evening we gapped down off the Sunday open, lost the big shelf at 6793 from Wed/Thursday last week, then recovered and ripped. This rip broke ES out of a range it spent all last week in mostly 6793 to 6872. We can easily return into that range and do more work. My general lean though has to respect the ...
- Nearest support context: line 2588: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2592: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2612 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6353.0=swept_lost_low; 6360.0=current_price_context; 6662.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw it Monday March 30th as stated and this was a major accumulation event as institutions prepped for what ended up being a 480 point leg up - as always, we followed them: ES plunged to 6353 Monday March 30th in evening going elevator down. In doing so, we swept a shelf of lows from Sunday March 29th/Monday March 30th at 6360. I wrote Monday March 30t...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2616 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=6780.0; non_acceptance=none; invalidation=none; target/response=6880.0
- Level roles: 6780.0=actual_setup_level+recovered_level; 6760.0=swept_lost_low; 6880.0=target_or_response; 6882.0=current_price_context; 6902.0=current_price_context; 6937.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6780.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: After a big rally like this, bulls had to rest, and (as always) buy the next dip via a Failed Breakdown. That dip came off the open last night. I wrote on Friday at 4pm: “6780 is below there. This was yesterday’s (Wednesday’s) low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.” ES flushed to 6760’s last evening, r...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2653 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6595.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6595.0=actual_setup_level
- Time mentions: 11:15AM
- S/R coincidence: 6595.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 11:15AM 6595 Failed Breakdown we saw Tuesday, discussed in Tuesday’s newsletter. I verified this at the close yesterday, stating: “ I am still holding my 10% long runner from the 11:15AM 6595 Failed Breakdown, discussed above.”
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2661 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6595.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0
- Level roles: 6572.0=current_price_context; 6595.0=actual_setup_level; 6647.0=target_or_response; 6850.0=current_price_context
- Time mentions: 11am, 11:15PM
- S/R coincidence: 6595.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: We went elevator down nearly 100 points to 6572 by 11am Tuesday. Shortly after, we put in a Failed Breakdown of 6595 (at 11:15PM on Sunday April 5th ES put in a large bounce at 6595 to 6560s making it a clear significant low of the sort we would want to trade a loss and recovery of) and we ripped to 6647+ after to set the high of day for Tuesday’s regular...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2663 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=6788.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6780.0=current_price_context; 6788.0=swept_lost_low; 6873.0=current_price_context; 6880.0=current_price_context
- Time mentions: 10:40AM, 11am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then last Wednesday? Similar drill. ES went elevator down from 6850 to 6780 by 10:40AM. In doing so, ES lost a big low set at 6788 at 830PM Tuesday evening. This low recovered by 11am Wednesday (Failed Breakdown) and that Failed Breakdown maintained strength to 6873+ into Thursday which then pressed further into 6880’s on Friday.
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2665 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6793.0; swept/lost=none; recovered=6793.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level+recovered_level; 6900.0=current_price_context
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup
- Source: From there? Gap down/Elevator down Sunday to 6760s. As always, this would resolve with a short squeeze, but only when we get a Failed Breakdown. As I will discuss below, at around 8:45PM last evening ES recovered a 5-touch shelf of lows at 6793 from last Wednesday/Thursday, and we ripped from there to 6900+ today.
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-08T09:56:00-04:00 minus 60 minutes through 2026-04-08T09:59:00-04:00 plus 90 minutes; trap_low=6780.0; reclaim=2026-04-08T09:59:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2673 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6360.0; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0, 6880.0
- Level roles: 6360.0=actual_setup_level; 6353.0=swept_lost_low; 6647.0=target_or_response; 6662.0=current_price_context; 6582.0=current_price_context; 6872.0=current_price_context; 6848.0=current_price_context
- Time mentions: 8:30PM
- S/R coincidence: 6360.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: 2) The basic theme heading into today was that Monday March 30th at 8:30PM ES put in a monster Failed Breakdown at the 6360 level. All major rallies and institutional accumulation events start this way, and last weeks was no different. We had a shelf of lows there (Sunday’s March 29 low & Monday’s March 30th regular hours low) at 6360. We flushed that she...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2675 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=6780.0; swept/lost=6760.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6872.0=current_price_context; 6848.0=current_price_context; 6780.0=actual_setup_level; 6793.0=current_price_context; 6900.0=current_price_context
- Time mentions: 6pm, 10am
- S/R coincidence: 6780.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Last evening, this tight 6872-6848 range broke down off the Sunday 6pm open due to Iran non-deal headlines and we sold off down to 6760s. Since we gapped lower and had to stalk Failed Breakdown’s which I discuss in more detail below. As we will see, ES put in a huge Failed Breakdown of the 6780/6793 low/shelf of lows last week. By 10am today, we ripped to...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2689 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6848.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Sunday Evening, the Gap Down, and the un-triggered 6848 Failed Breakdown
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T04:54:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6800.5; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2697 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6848.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level
- Time mentions: 12:45PM
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: My most recent entry was the 12:45PM mini Failed Breakdown of 6848 we saw today. This Tuesday long evolved into a 280+ point long. This was an incredibly low volatility, slow session in ES. As I’ve said many times, we need volatility to trade. Trading without volatility is like driving a car without gas - it just won’t go anywhere. Many of my followers ar...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T04:54:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6800.5; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2701 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6848.0; swept/lost=6840.0, 6847.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=actual_setup_level; 6847.0=swept_lost_low; 6840.0=swept_lost_low
- Time mentions: 4pm, 12:40PM
- S/R coincidence: 6848.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_planned_setup
- Source: The first possible entry was down was a Failed Breakdown of 6848-52. I wrote on Friday at 4pm: “6848-52 is first support down and this has been tested 5x in the last 24hrs with one small flush today. I would not engage this zone again as it is too well tested, but if we can flush today’s 6847 low (perhaps down to 6840) and recover, this would be an action...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-09T10:42:00-04:00 minus 60 minutes through 2026-04-09T10:53:00-04:00 plus 90 minutes; trap_low=6839.0; reclaim=2026-04-09T10:53:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2703 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why was 6848-52 flush and recovery a Failed Breakdown? Remember a Failed Breakdown requires price to lose and recover a significant low.
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2705 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context
- Time mentions: 1:40PM, 12:40PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 6848-52 we had #2: A clear cluster or shelf of lows. Specifically between 1:40PM Thursday and 12:40PM Friday ES put in a clear 5 touch shelf of lows there. The flush and recovery of this shelf would b...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2714 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6853.0; invalidation=none; target/response=none
- Level roles: 6848.0=current_price_context; 6853.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (6848) by 5 points (6853) and holds at or above 6853 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2716 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=6793.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=actual_setup_level
- Time mentions: 8:45PM
- S/R coincidence: 6793.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 8:45PM 6793 Failed Breakdown
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: render ES 1m from 2026-04-08T09:56:00-04:00 minus 60 minutes through 2026-04-08T09:59:00-04:00 plus 90 minutes; trap_low=6780.0; reclaim=2026-04-08T09:59:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2720 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6780.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: I wrote Friday at 4pm: “6780 is below there. This was yesterday’s (Wednesday’s) low of day. A flush and recovery of this low is a clear Failed Breakdown and a powerful one.”
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2727 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6770.0, 6780.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6780.0=swept_lost_low; 6793.0=current_price_context; 6770.0=swept_lost_low
- Time mentions: 6pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Why 6780 and 6793? Specifically, 6780 (as stated) was last Wednesday’s low of day from which we rallied 105 points. The flush and recovery of this would be actionable per the above criteria. At 6pm we flushed 6780 down to 6770.
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2743 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6830.0
- Level roles: 6830.0=target_or_response
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When I woke up and checked price at 730AM, I was happy to see the long had paid nicely and we ran to 6830’s overnight. From here, there is little for me to do but hold my runner and do nothing. I did my job and my job is clear and simple: I wait for an elevator down sell to produce a Failed Breakdown, I manage level to level, then I stop trading and hold ...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2762 `needs_bigger_crop`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: planned_setup
- Levels: setup=6793.0, 6765.0, 6595.0, 6851.0; swept/lost=6868.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6595.0=actual_setup_level; 6793.0=actual_setup_level; 6872.0=current_price_context; 6868.0=swept_lost_low; 6861.0=current_price_context; 6848.0=current_price_context; 6851.0=actual_setup_level; 6818.0=current_price_context; 6802.0=current_price_context; 6775.0=current_price_context; 6765.0=actual_setup_level
- Time mentions: 11:15AM, 8:45PM, 8am
- S/R coincidence: 6793.0=coincides_cleanly; 6765.0=coincides_cleanly; 6595.0=coincides_partially; 6851.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my my 10% long runner from the 11:15AM 6595 Failed Breakdown last Tuesday. My most recent entry was the 6793 Failed Breakdown at 8:45PM last evening, discussed above. Bulls bought the dip last night and they bought the dip the same way they always do: Via a Failed Breakdown of 6793. Readers shouldn’t be ...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2768 `negative_control`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=current_price_context; 6848.0=current_price_context; 6844.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: 6793 must fail, for those who want a more aggressive, high risk short 6848 failure is a possible short. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally....
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2770 `data_only`

- Context: Is Buy The Dip Back In SPX? April 14 Plan | pub=2026-04-13 | plan=2026-04-14
- Source mode: context_recap
- Levels: setup=none; swept/lost=6793.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=swept_lost_low; 6872.0=current_price_context; 6903.0=current_price_context; 6923.0=current_price_context; 6930.0=current_price_context; 6949.0=current_price_context; 6978.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: The long keeps paying. Last evening we gapped down off the Sunday open, lost the big shelf at 6793 from Wed/Thursday last week, then recovered and ripped. This rip broke ES out of a range it spent all last week in mostly 6793 to 6872. We can easily return into that range and do more work. My general lean though has to respect the ...
- Nearest support context: line 2760: Supports are: 6886, 6881, 6872 (major), 6868, 6861 (major), 6851, 6848 (major), 6839, 6832 (major), 6829, 6818-22 (major), 6807, 6804 (major), 6793 (major), 6786, 6775 (major), 6769, 6761-65 (major), 6755, 6749 (major), 6743, 6735 (major), 6725, 6716 (major), 6709, 6703, 6696, 6691 (major), 6684, 6678 (major), 6670, 6664 (major), 6653, 6647, 6639 (major),...
- Nearest resistance context: line 2764: Resistances are: 6903 (major), 6911, 6917, 6923 (major), 6932 (major), 6938, 6945, 6949 (major), 6958, 6967 (major), 6974, 6978 (major), 6992, 7002 (major), 7008, 7012, 7016, 7021 (major), 7030, 7034, 7042, 7048 (major), 7052, 7057 (major), 7067, 7072, 7087 (major), 7093, 7101 (major), 7112, 7128 (major). As readers know I don’t short ES - I only get my p...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-09, 2026-04-10, 2026-04-13, 2026-04-14, 2026-04-15

### data\research\mancini\The Longer Mancini Logs.txt:2784 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: planned_setup
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6353.0=swept_lost_low; 6360.0=current_price_context; 6650.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw it last Monday March 30th as stated and this was a major accumulation event as institutions prepped for what ended up being a 480 point leg up - as always, we followed them: ES plunged to 6353 last Monday March 30th in evening going elevator down. In doing so, we swept a shelf of lows from Sunday March 29th/Monday March 30th at 6360. I wrote last M...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2825 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=6595.0, 6593.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6595.0=actual_setup_level; 6593.0=actual_setup_level
- Time mentions: 11:15AM, 11am
- S/R coincidence: 6595.0=coincides_partially; 6593.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 11:15AM 6595 Failed Breakdown we saw Tuesday, discussed in Tuesday’s newsletter and this evolved into a monster 200+ point long. I verified this at the close yesterday, stating: “I am still holding my 10% long runner from yesterday’s 6593 Failed Breakdown that occurred at 11am and this ev...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2831 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=6593.0; swept/lost=6565.0; recovered=6593.0; non_acceptance=none; invalidation=none; target/response=6660.0
- Level roles: 6615.0=current_price_context; 6565.0=swept_lost_low; 6593.0=actual_setup_level+recovered_level; 6660.0=target_or_response
- Time mentions: 6pm, 8pm
- S/R coincidence: 6593.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: We saw exactly this off the Sunday open. At 6pm futures gapped down from 6615+, then went elevator down to 6565 or so. Shortly after - around 8pm - ES recovered 6593 which was a huge shelf of lows from Thursday and to a lesser extent Friday. This was a Failed Breakdown and from there, we short squeezed to 6660+ Monday high of day.
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2833 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=6595.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0
- Level roles: 6572.0=current_price_context; 6595.0=actual_setup_level; 6647.0=target_or_response; 6850.0=current_price_context
- Time mentions: 11am, 11:15PM
- S/R coincidence: 6595.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Then Tuesday? The cycle restarts. We went elevator down nearly 100 points to 6572 by 11am Tuesday. Shortly after, we put in a Failed Breakdown of 6595 (at 11:15PM on Sunday ES put in a large bounce at 6595 to 6560s making it a clear significant low) and we ripped to 6647+ after to set the high of day for Tuesday’s regular hours. Then Tuesday evening, this...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: render ES 1m from 2026-04-05T18:01:00-04:00 minus 60 minutes through 2026-04-05T19:01:00-04:00 plus 90 minutes; trap_low=6585.0; reclaim=2026-04-05T19:01:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2835 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6788.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6780.0=current_price_context; 6788.0=swept_lost_low; 6873.0=current_price_context
- Time mentions: 10:40AM, 11am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then Wednesday? Similar drill. ES went elevator down from 6850 to 6780 by 10:40AM. In doing so, ES lost a big low set at 6788 at 830PM Tuesday evening. This low recovered by 11am yesterday (Failed Breakdown) and that Failed Breakdown maintained strength to 6873+ into today.
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2843 `needs_bigger_crop`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: actual_recap
- Levels: setup=6360.0; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0, 6850.0
- Level roles: 6360.0=actual_setup_level; 6353.0=swept_lost_low; 6647.0=target_or_response; 6662.0=current_price_context; 6582.0=current_price_context; 6850.0=target_or_response
- Time mentions: 8:30PM
- S/R coincidence: 6360.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: 2) The basic theme heading into today was that last Monday March 30th at 8:30PM ES put in a monster Failed Breakdown at the 6360 level. All major rallies and institutional accumulation events start this way, and last weeks was no different. We had a shelf of lows there (Sunday’s March 29 low & Monday’s March 39th regular hours low) at 6360. We flushed tha...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2845 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=current_price_context; 6353.0=swept_lost_low; 6662.0=current_price_context; 6788.0=current_price_context; 6830.0=current_price_context; 6846.0=current_price_context; 6873.0=current_price_context; 6893.0=current_price_context; 6903.0=current_price_context; 6809.0=current_price_context
- Time mentions: 11pm, 12:20PM, 2pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Back on Monday March 30th, ES put in a huge Failed Breakdown where we swept the Sunday March 29th low/Monday March 30th regular hours shelf of lows at 6360 down to 6353. We then rallied ~290 points into last weeks highs. Then, all last week, ES built a massive sideways bull flag with resistance at 6662 mostly, tapped 4x since then. Yes...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2863 `needs_bigger_crop`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: planned_setup
- Levels: setup=6593.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6815.0=current_price_context; 6593.0=actual_setup_level
- Time mentions: none
- S/R coincidence: 6593.0=does_not_coincide
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, setup_level_does_not_coincide_with_sr_or_prose_context, source_mode_planned_setup
- Source: We closed up yesterday around 6815 and the runner from Tuesday’s 6593 Failed Breakdown continued to work. This meant - for me - there was little to do but hold my runner and wait for the next elevator down sell.
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: render ES 1m from 2026-04-05T18:03:00-04:00 minus 60 minutes through 2026-04-05T19:00:00-04:00 plus 90 minutes; trap_low=6582.75; reclaim=2026-04-05T19:00:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2893 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6814.0; invalidation=none; target/response=none
- Level roles: 6809.0=current_price_context; 6814.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Remember the non-acceptance protocol automatically activates when price recovers the significant low (6809) by 5 points (6814) and holds at or above 6814 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2901 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6793.0=current_price_context
- Time mentions: 4pm, 3pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When I woke up and checked price at 730AM almost nothing happened overnight and we were still in deep, low volatility consolidation. I wrote yesterday at 4pm: “6793 is 1st support down. At around 3pm ES set a nice low there and bounced ~20 points. The Failed Breakdown of this low is actionable.”
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2929 `needs_bigger_crop`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: planned_setup
- Levels: setup=6593.0, 6802.0; swept/lost=6821.0, 6826.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6593.0=actual_setup_level; 6821.0=swept_lost_low; 6848.0=current_price_context; 6826.0=swept_lost_low; 6809.0=current_price_context; 6802.0=actual_setup_level; 6793.0=current_price_context; 6780.0=current_price_context; 6756.0=current_price_context
- Time mentions: 11am, 2:35PM, 10:30AM
- S/R coincidence: 6593.0=coincides_partially; 6802.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from yesterday’s 6593 Failed Breakdown that occurred at 11am Tuesday and this evolved into a staggering 250+ point long and this is exactly why I hold runners. We had another massive run today so readers know what I’m going to say here. My job as a Failed Breakdown trader is to wait fo...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2933 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=current_price_context; 6353.0=swept_lost_low; 6662.0=current_price_context; 6820.0=current_price_context; 6903.0=current_price_context; 6922.0=current_price_context; 6938.0=current_price_context; 6872.0=current_price_context; 6848.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Bulls are firmly back in control. Back on Monday March 30th, ES put in a huge Failed Breakdown where we swept the Sunday March 29th low/Monday March 30th regular hours shelf of lows at 6360 down to 6353. This was a huge institutional accumulation event and we got long then originally as I’ve discussed at length. We then rallied ~290 po...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2935 `negative_control`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6802.0=current_price_context; 6798.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: 6802 has to fail. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mastere...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2937 `data_only`

- Context: Massive Breakout Underway For SPX. How Much More Upside? April 10 Plan | pub=2026-04-09 | plan=2026-04-10
- Source mode: context_recap
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=current_price_context; 6353.0=swept_lost_low; 6826.0=current_price_context; 6903.0=current_price_context; 6922.0=current_price_context; 6938.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: Back on Monday March 30th, ES put in a huge Failed Breakdown where we swept the Sunday March 29th low/Monday March 30th regular hours shelf of lows at 6360 down to 6353. This was a huge institutional accumulation event and we got long then originally as I’ve discussed at length. Since then, its been one way traffic. On Tuesday, th...
- Nearest support context: line 2927: Supports are: 6861, 6853, 6848 (major), 6840, 6830, 6826-21 (Major), 6819, 6809 (major), 6802, 6793 (major), 6786, 6780 (major), 6775, 6766, 6756 (major), 6743, 6735 (major), 6728, 6722, 6716 (major), 6707, 6702, 6695, 6689 (major), 6684, 6678 (major), 6671, 6663 (major), 6653, 6647 (major), 6644, 6639, 6623-26 (major), 6616, 6611, 6604 (major), 6592 (maj...
- Nearest resistance context: line 2931: Resistances are: 6869, 6872 (major), 6881 (major), 6892, 6900-05 (major), 6913, 6922 (major), 6927, 6937 (major), 6945, 6949, 6954, 6959 (major), 6968, 6975-80 (major), 6994, 7002 (major), 7007, 7013, 7020 (major), 7025, 7035, 7044 (major), 7057, 7063, 7068, 7073 (major), 7086, 7093, 7100, 7122, 7130 (major). As readers know I don’t short ES - I only get ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-04-06, 2026-04-07, 2026-04-08, 2026-04-09, 2026-04-10

### data\research\mancini\The Longer Mancini Logs.txt:2953 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: planned_setup
- Levels: setup=none; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6353.0=swept_lost_low; 6360.0=current_price_context; 6647.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw exactly this Monday evening and it started this huge leg up. ES plunged to 6353 last evening going elevator down. In doing so, we swept a shelf of lows from Sunday/Monday at 6360. I wrote Monday at 4pm: “As of writing though 6360 is first support down. This was a big support where we set the Sunday low of day and today’s low of day. I wouldn’t bid ...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:2994 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: actual_recap
- Levels: setup=6360.0; swept/lost=6353.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=actual_setup_level; 6353.0=swept_lost_low
- Time mentions: 4pm
- S/R coincidence: 6360.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Heading into today, I was holding a runner from a Failed Breakdown we saw at 830pm Monday. This was a Failed Breakdown of the the shelf of lows we saw at 6360 consisting of the Sunday evening low and the Monday major regular hours low. We swept it Monday evening 830PM, recovered, and ripped. This setup was provided explictly on Monday at 4pm when I wrote:...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-30T19:23:00-04:00 minus 60 minutes through 2026-03-30T19:25:00-04:00 plus 90 minutes; trap_low=6353.25; reclaim=2026-03-30T19:25:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:2996 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6360.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=actual_setup_level
- Time mentions: 4pm
- S/R coincidence: 6360.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: I verified I was still holding the long runner on this Wednesday at 4pm when I wrote: “I am still holding my 10% long runner from the classic 6360 Failed Breakdown we saw at 830PM last night, discussed above and provided yesterday.”
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-30T19:23:00-04:00 minus 60 minutes through 2026-03-30T19:25:00-04:00 plus 90 minutes; trap_low=6353.25; reclaim=2026-03-30T19:25:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3002 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6360.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6392.0=current_price_context; 6353.0=current_price_context; 6360.0=actual_setup_level; 6647.0=current_price_context
- Time mentions: 6pm
- S/R coincidence: 6360.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: We saw exactly this Monday evening. Monday evening ES went elevator down from 6392 at 6pm to 6353 by 820pm. Shortly after, ES put in a Failed Breakdown of Sunday’s 6360 daily low AND Monday’s 6360 regular hours low which was located in the same spot, and we ripped a staggering 280+ points into 6647 yesterday.
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-30T19:23:00-04:00 minus 60 minutes through 2026-03-30T19:25:00-04:00 plus 90 minutes; trap_low=6353.25; reclaim=2026-03-30T19:25:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3004 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This is the power of the Failed Breakdown: Price sets a shelf of lows (6360), traps shorts and runs stops below it, recovers, and we rip parabolically. Not every failed breakdown works this well though - some just go 5 or 10 points then fail. That is fine too. We don’t need to predict which is which. We just manage level to level, leave a runner, price do...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3008 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6520.0=current_price_context; 6640.0=current_price_context
- Time mentions: 2am, 9:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In doing so, ES swept a 30 point low set at 2am Friday at 6520. By 9:30AM this morning, that low recovered (Failed Breakdown) and the squeeze began to 6640+
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3016 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: actual_recap
- Levels: setup=6360.0; swept/lost=6353.0, 6360.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6360.0=actual_setup_level+swept_lost_low; 6353.0=swept_lost_low; 6647.0=current_price_context
- Time mentions: 8:30PM
- S/R coincidence: 6360.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: 2) The basic theme today was that at 8:30PM Monday, ES put in a massive Failed Breakdown. We swept the Sunday/Monday 6360 lows down to 6353, recovered, and ripped for two days straight into yesterday’s 6647 high. Recall that all major rallies in ES start this way. We never need to predict when a rally will occur, we just follow institutions in. Institutio...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-30T19:23:00-04:00 minus 60 minutes through 2026-03-30T19:25:00-04:00 plus 90 minutes; trap_low=6353.25; reclaim=2026-03-30T19:25:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3018 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: actual_recap
- Levels: setup=6520.0; swept/lost=6503.0; recovered=6520.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6503.0=swept_lost_low; 6520.0=actual_setup_level+recovered_level; 6592.0=current_price_context; 6647.0=current_price_context; 6677.0=current_price_context; 6688.0=current_price_context; 6716.0=current_price_context; 6765.0=current_price_context
- Time mentions: 2am
- S/R coincidence: 6520.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: As stated above, we sold down to 6503 by this morning, recovered a big low set at 2am at 6520 (Failed Breakdown), then ripped this morning. I wrote yesterday: “t. My general lean is that ES can hold 6592 though (or quick trap below). From there we resume up to 6647. Perhaps final dip there, then breakout sees 6677, 6688, 6716, 6765.”
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-31T11:39:00-04:00 minus 60 minutes through 2026-03-31T11:40:00-04:00 plus 90 minutes; trap_low=6503.0; reclaim=2026-03-31T11:40:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3034 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6603.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6603.0=actual_setup_level
- Time mentions: 9pm
- S/R coincidence: 6603.0=coincides_partially
- Chart/window: artifacts\research\mancini-real-packet-gallery\076_accepted_classic_acceptance_second_attempt_reclaim_20260405_1926_6603.0.svg trap=6598.0 reclaim=2026-04-05T19:23:00-04:00 threshold_hold=0 visual=dangerous_demote_for_training visual_reasons=closed_back_below_level_soon_after_reclaim overlap=7
- Blockers: no_source_stated_swept_low_below_setup, source_mode_context_recap, visual_sanity_dangerous_demote_for_training
- Source: Tuesday Evening, the 9pm Trump Speech, And The 6603 Failed Breakdown
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...

### data\research\mancini\The Longer Mancini Logs.txt:3036 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: planned_setup
- Levels: setup=6360.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6620.0=current_price_context; 6360.0=actual_setup_level
- Time mentions: 4pm
- S/R coincidence: 6360.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: We closed up yesterday around 6620 after a monster rally driven by the 6360 Failed Breakdown Monday evening, discussed extensively above and on Monday. Unfortunately, after a rip like this, there is nothing to do. I wrote at 4pm yesterday: “We just had a massive 200 point rally today. My job is to position before these squeezes, on Failed Breakdowns which...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-30T19:23:00-04:00 minus 60 minutes through 2026-03-30T19:25:00-04:00 plus 90 minutes; trap_low=6353.25; reclaim=2026-03-30T19:25:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3042 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: planned_setup
- Levels: setup=6603.0; swept/lost=6603.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6603.0=actual_setup_level+swept_lost_low; 6593.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: 6603.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: The first possible entry was the Failed Breakdown of 6603. I wrote yesterday at 4pm: “We therefore set a clear significant low here. Instead of bidding 6603, the safest bet is to wait for the Failed Breakdown. If we can flush 6603 to 6593 (a big support in itself) and recover, this is a good entry.”
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-04-02T03:37:00-04:00 minus 60 minutes through 2026-04-02T09:36:00-04:00 plus 90 minutes; trap_low=6543.25; reclaim=2026-04-02T09:36:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3048 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6603.0=current_price_context
- Time mentions: 2:30PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 6603 we had #2. We put in a nice bounce here at 2:30PM yesterday, bouncing ~30 points. Therefore, the flush and recovery of this would be actionable.
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3057 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6608.0; invalidation=none; target/response=none
- Level roles: 6603.0=current_price_context; 6608.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\078_accepted_classic_acceptance_backtest_from_below_20260405_1958_6608.0.svg trap=6605.5 reclaim=2026-04-05T19:55:00-04:00 threshold_hold=0 visual=training_candidate overlap=19
- Blockers: no_actual_setup_level_extracted
- Source: Rememeber the non-acceptance protocol automatically activates when price recovers the significant low (6603) by 5 points (6608) and holds at or abov 6608 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...

### data\research\mancini\The Longer Mancini Logs.txt:3059 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: data_context
- Levels: setup=none; swept/lost=6603.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6603.0=swept_lost_low; 6593.0=current_price_context; 6608.0=current_price_context; 6614.0=current_price_context; 6624.0=current_price_context; 6631.0=current_price_context
- Time mentions: 9:02PM, 9:09PM, 9:10PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Around 9:02PM - right after the speech began - ES flushed 6603 down to ~6593 as stated above. By 9:09PM, we returned to 6603 and recovered. By 9:10PM, ES was at 6608 and we very rapidly pushed through as headline volatility commenced. I decided to grab some long here at 6614 or so on the rise. This was managed as always: Lock in 75% profits at 6624 1st up...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3065 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6525.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6525.0=actual_setup_level
- Time mentions: 9:28AM
- S/R coincidence: 6525.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Thursday Morning and the 9:28AM 6525 Failed Breakdown
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-31T05:41:00-04:00 minus 60 minutes through 2026-03-31T11:40:00-04:00 plus 90 minutes; trap_low=6424.5; reclaim=2026-03-31T11:40:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3067 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6520.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6514.0=current_price_context; 6520.0=actual_setup_level
- Time mentions: 2am
- S/R coincidence: 6520.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: When I woke up and checked price at 730AM we were down at 6514 and there was a very obvious Failed Breakdown that jumped out at me. Specifically, at 2am, ES set a significant low at 6520 from which we rallied 30 points, meeting the criteria of a significant low.
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-03-31T05:41:00-04:00 minus 60 minutes through 2026-03-31T11:40:00-04:00 plus 90 minutes; trap_low=6424.5; reclaim=2026-03-31T11:40:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3071 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6514.0=current_price_context; 6520.0=current_price_context; 6525.0=current_price_context
- Time mentions: 7:50AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Since was a fairly shallow Failed Breakdown (only 6 points to 6514) the non-acceptance protocol would be used. 6520+5=6525. One can long when price holds above 6525 for a few minutes. I also tweeted this at 7:50AM:
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3097 `needs_bigger_crop`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: actual_recap
- Levels: setup=6592.0, 6505.0, 6525.0, 6520.0; swept/lost=6353.0, 6506.0, 6592.0, 6499.0, 6505.0; recovered=6520.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6525.0=actual_setup_level; 6360.0=current_price_context; 6353.0=swept_lost_low; 6506.0=swept_lost_low; 6520.0=actual_setup_level+recovered_level; 6604.0=current_price_context; 6592.0=actual_setup_level+swept_lost_low; 6586.0=current_price_context; 6593.0=current_price_context; 6553.0=current_price_context; 6563.0=current_price_context; 6499.0=swept_lost_low; 6505.0=actual_setup_level+swept_lost_low; 6484.0=current_price_context; 6447.0=current_price_context
- Time mentions: 9:28AM, 2am, 9:30AM, 12:20PM, 2pm
- S/R coincidence: 6592.0=coincides_cleanly; 6505.0=coincides_partially; 6525.0=coincides_cleanly; 6520.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 9:28AM 6525 Failed Breakdown we saw today, discussed above. Also note that markets are closed tomorrow for Good Friday, meaning this plan is for Monday. We had a massive rip today in ES but we ultimately closed not far from where we did yesterday. Bulls did what they had to do...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3101 `data_only`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: context_recap
- Levels: setup=6520.0; swept/lost=6353.0, 6506.0; recovered=6520.0; non_acceptance=none; invalidation=none; target/response=6677.0
- Level roles: 6360.0=current_price_context; 6353.0=swept_lost_low; 6506.0=swept_lost_low; 6520.0=actual_setup_level+recovered_level; 6592.0=current_price_context; 6624.0=current_price_context; 6677.0=target_or_response; 6716.0=current_price_context
- Time mentions: 2am, 9:30AM
- S/R coincidence: 6520.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case Monday: As stated above, “on Monday evening at 830PM, ES put in a massive Failed Breakdown where we swept the Sunday/Monday regular hours shelf of lows at 6360 down to 6353. We then rallied ~290 points into this weeks highs. After a big squeeze like this, a dip is inevitable, but the question is whether or not that dip gets bought on the first p...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: render ES 1m from 2026-04-02T07:03:00-04:00 minus 60 minutes through 2026-04-02T07:46:00-04:00 plus 90 minutes; trap_low=6506.0; reclaim=2026-04-02T07:46:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3103 `negative_control`

- Context: Bulls Bought The Dip Today In SPX. Can They Run It Now? April 6 Plan | pub=2026-04-02 | plan=2026-04-06
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6500.0=current_price_context; 6593.0=current_price_context; 6585.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: No real bear case until 6500 fails which is a ways down now. There is a possible short below 6593 now though. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades perso...
- Nearest support context: line 3095: Supports are: 6616, 6609, 6604 (major), 6597, 6592 (major), 6582, 6575, 6567, 6563 (major), 6553 (major), 6549, 6543, 6537, 6525-30 (major), 6520, 6512, 6506, 6499 (major), 6490, 6484 (major), 6477, 6467 (major), 6460, 6454, 6447 (major), 6436, 6426, 6420 (major), 6411 (major), 6398, 6394, 6386 (major), 6377, 6372, 6366 (major), 6360, 6353 (major), 6348, ...
- Nearest resistance context: line 3099: Resistances are: 6624 (major), 6638, 6646 (major), 6653, 6663, 6671, 6678 (major), 6682, 6692 (major), 6703, 6716 (major), 6722, 6735 (major), 6744, 6755, 6766 (major), 6769, 6779 (major), 6786, 6793, 6802 (major), 6809 (major), 6815, 6825, 6833 (major), 6839, 6845, 6853, 6858-60 (major). As readers know I don’t short ES - I only get my points on the long...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02, 2026-04-03, 2026-04-06, 2026-04-07

### data\research\mancini\The Longer Mancini Logs.txt:3121 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=6524.0; swept/lost=6484.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6484.0=swept_lost_low; 6524.0=actual_setup_level; 6505.0=current_price_context; 6720.0=current_price_context
- Time mentions: 3am, 4pm, 4am
- S/R coincidence: 6524.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_planned_setup
- Source: We saw exactly this early Monday morning this week. ES went elevator down to 6484 by 3am. I wrote last Friday at 4pm: “This is where I get interested, and an obvious trade is the Failed Breakdown of today’s 6524 daily low. This is a clear daily low and a flush and recovery of this is actionable.” Around 4am Monday, ES not only recovered Friday’s 6524 dail...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3123 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: actual_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6593.0=current_price_context; 6690.0=current_price_context; 6623.0=current_price_context; 6575.0=current_price_context; 6638.0=current_price_context; 6663.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: After this big rally though, ES spent all day yesterday into today consolidating and digesting the move. The bounds of this consolidation were mostly 6593 to 6690 with 6623 being a pivot inside. Yesterday morning, ES went elevator down and trapped below support of this range to 6575, recovered, and ripped back into it (Failed Breakdown). The task today wa...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3159 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: actual_recap
- Levels: setup=6586.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6593.0=current_price_context; 6586.0=actual_setup_level
- Time mentions: 10:08AM, 10am
- S/R coincidence: 6586.0=does_not_coincide
- Chart/window: artifacts\research\mancini-real-packet-gallery\065_accepted_classic_acceptance_second_attempt_reclaim_20260326_0443_6586.0.svg trap=6581.25 reclaim=2026-03-26T04:36:00-04:00 threshold_hold=5 visual=dangerous_demote_for_training visual_reasons=weak_raw_price_only_provenance,closed_back_below_level_soon_after_reclaim overlap=11
- Blockers: no_source_stated_swept_low_below_setup, setup_level_does_not_coincide_with_sr_or_prose_context, visual_sanity_dangerous_demote_for_training
- Source: Heading into today, I was still holding a 10% long runner from a Failed Breakdown we saw at 10:08AM yesterday of 6593-86 which was a big low set very early Tuesday morning. We swept it just after the Tuesday 930AM open, recovered it after 10am, and ran. I discussed this in detail in yesterday’s trade recap section, and confirmed the positioning at the clo...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...

### data\research\mancini\The Longer Mancini Logs.txt:3169 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: actual_recap
- Levels: setup=6623.0; swept/lost=6617.0; recovered=6623.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6700.0=current_price_context; 6617.0=swept_lost_low; 6623.0=actual_setup_level+recovered_level
- Time mentions: 8am
- S/R coincidence: 6623.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Then from Monday’s 6700+ high? Another Failed Breakdown Monday afteroon. We went elevator down to 6617 by noon or so, recovered a big low set at 8am at 6623, and rallied again to 6700 to set the high of day.
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: render ES 1m from 2026-03-19T19:27:00-04:00 minus 60 minutes through 2026-03-19T20:04:00-04:00 plus 90 minutes; trap_low=6616.75; reclaim=2026-03-19T20:04:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3171 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6573.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6647.0
- Level roles: 6573.0=swept_lost_low; 6586.0=current_price_context; 6647.0=target_or_response
- Time mentions: 9:40AM, 1:15AM, 10:05AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Tuesday, the cycle then repeated. We went elevator down to 6573 by 9:40AM today. In doing so, ES lost a big low set overnight at 1:15AM at 6586. We recovered that low around 10:05AM today (more detail on that below - this was a Failed Breakdown), then ripped to 6647 high of day yesterday.
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3173 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: actual_recap
- Levels: setup=6638.0; swept/lost=6619.0; recovered=6638.0; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6619.0=swept_lost_low; 6638.0=actual_setup_level+recovered_level; 6650.0=current_price_context
- Time mentions: 11am
- S/R coincidence: 6638.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: Then today? After tons of overnight chop we went elevator down to 6619 by 11am today. Shortly after, we recovered a big shelf of lows at 6638 set overnight (Failed Breakdown) and ripped yet again to 6650+.
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3183 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6593.0=current_price_context; 6690.0=current_price_context; 6623.0=current_price_context; 6638.0=current_price_context; 6575.0=current_price_context; 6662.0=current_price_context; 6716.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: Quite simple. After a 200+ point rally on Sunday/Monday, ES is now consolidating. The range heading into tomorrow is mostly 6593 support, with 6690 resistance. Inside this range, 6623 and 6638 are key pivots. Generally the bull case for tomorrow is simple. Bulls want to hold 6593. If we do flush it, make it a quick trap below today’s 6...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3201 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6604.0=current_price_context; 6598.0=current_price_context
- Time mentions: 4pm, 1:40PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 6604 was first support down after 4pm yesterday. I wrote yesterday at 4pm: “6604 is first support down as of writing. This is a zone we have tested many times today. While one could buy it directly, a much safer choice is to wait for a Failed Breakdown of the 1:40PM 6598 low. This was a big low from which we rallied 43 points, making it a significant low....
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3203 `negative_control`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: negative_control
- Levels: setup=none; swept/lost=6598.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6604.0=current_price_context; 6598.0=swept_lost_low
- Time mentions: 3:50PM
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Around 3:50PM ES sold to ~6604 and bounced. Unfortunately, we never got that flush of 6598 initially. Why would 6598 be a Failed Breakdown though?
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3207 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6598.0=current_price_context
- Time mentions: 1:40PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: A significant low has three possible definitions. 1) The prior days low 2) A multi-hour low/ a low that goes 20+ points or 3) A cluster or shelf of lows. At 6598 we had #2. At 1:40PM on Tuesday, ES set a low there from which we rallied 43 points. This is a clear, V-shaped low of the sort we’d want to see a flush and recovery of.
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3216 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6603.0; invalidation=none; target/response=none
- Level roles: 6598.0=current_price_context; 6603.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: artifacts\research\mancini-real-packet-gallery\067_accepted_non_acceptance_protocol_20260326_0847_6603.0.svg trap=6579.75 reclaim=2026-03-26T08:44:00-04:00 threshold_hold=2 visual=insufficient_visual_context overlap=19
- Blockers: no_actual_setup_level_extracted
- Source: Rememeber the non-acceptance protocol automatically activates when price recovers the significant low (6598) by 5 points (6603) and holds at or abov 6603 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typica...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...

### data\research\mancini\The Longer Mancini Logs.txt:3239 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6623.0=current_price_context
- Time mentions: 8am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The Level Reclaim does not have this. Rather, the Level Reclaim involves ES recovering a clear horizontal support/resistance trendline. Instead of there being a low that sweeps, traps, and recovers like the Failed Breakdown, here we have a clear classical horizontal trendline. This was 6623 and you can draw this line by taking a horizontal, sticking it at...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3241 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: context_recap
- Levels: setup=6638.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6638.0=actual_setup_level
- Time mentions: 10:10AM
- S/R coincidence: 6638.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Wednesday Morning and the 10:10AM 6638 Failed Breakdown
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3247 `data_only`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=none; swept/lost=6638.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6684.0
- Level roles: 6638.0=swept_lost_low; 6684.0=target_or_response; 6631.0=current_price_context
- Time mentions: 8am, 9:45AM, 10am, 2:35AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We ping ponged down to 6638 after 8am, then ripped into 6684+ by 9:45AM. and I let my runner pay. After this we got a nice elevator down sell to 6631 by 10am. This produced a quality Failed Breakdown. Specifically, we had a clear shelf of lows at 6638. We set lows here at 11:15Pm Tuesday, 2:35AM today, 830AM today. Recall that Failed Breakdowns occur when...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3258 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=6631.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6623.0=current_price_context; 6631.0=actual_setup_level; 6638.0=current_price_context; 6637.0=current_price_context
- Time mentions: 11:15AM, 10am, 11:20AM
- S/R coincidence: 6631.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: After this, we swept back to 6623 by 11:15AM. Since we lost the 10am 6631 low, my 10% runner trailed out, giving me a blank slate. I would be willing to take the recovery of that 6631 low long though and readers know I call these “double dip Failed Breakdowns”. However, since the 6638 shelf is just above, it is better to wait for that to clear also. I twe...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: render ES 1m from 2026-03-19T18:25:00-04:00 minus 60 minutes through 2026-03-19T20:38:00-04:00 plus 90 minutes; trap_low=6621.0; reclaim=2026-03-19T20:38:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3282 `needs_bigger_crop`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: planned_setup
- Levels: setup=6616.0, 6638.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6638.0=actual_setup_level; 6592.0=current_price_context; 6678.0=current_price_context; 6623.0=current_price_context; 6616.0=actual_setup_level; 6604.0=current_price_context; 6575.0=current_price_context; 6542.0=current_price_context; 6524.0=current_price_context
- Time mentions: 10:10AM
- S/R coincidence: 6616.0=coincides_cleanly; 6638.0=coincides_cleanly
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 10:10AM 6638 Failed Breakdown. Today was another session of tactical, level to level trading. We remain in what I call a Mode 2 range. Remember price can only do two things. It can trend (Mode 1, this is only 10% of sessions) or it can consolidate (Mode 2, this is 90% of sessi...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3288 `negative_control`

- Context: SPX Is Coiled Tight Still. Big Move Incoming. What Way? March 26 Plan | pub=2026-03-25 | plan=2026-03-26
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6592.0=current_price_context; 6593.0=current_price_context; 6585.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: Begins below 6592. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 3280: Supports are: 6638 (major), 6630, 6623 (major), 6616, 6608, 6604 (major), 6598, 6592 (major), 6588, 6584, 6575 (major), 6572, 6564 (major), 6558, 6553 (major), 6549, 6542 (major), 6536, 6530, 6524 (major), 6519, 6506 (major), 6499 (major), 6492, 6483, 6477 (major), 6466 (major), 6461, 6454, 6445, 6432-35 (major).
- Nearest resistance context: line 3284: Resistances are: 6642, 6647 (major), 6653, 6663 (major), 6667, 6672 (major), 6678 (major), 6684, 6690 (major), 6697, 6702 (major), 6708, 6716 (major), 6722, 6728 (major), 6735, 6742, 6749, 6760, 6766 (major), 6771, 6776, 6784 (major), 6787, 6792, 6799-6802 (major), 6809, 6815 (major), 6819, 6828, 6833 (major), 6845, 6854 (major), 6861, 6866-68 (major), 68...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-23, 2026-03-24, 2026-03-25, 2026-03-26, 2026-03-27

### data\research\mancini\The Longer Mancini Logs.txt:3304 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6815.0=current_price_context; 6819.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This what we had at 6815-19 early last week, tested countless times as support. It is also why I wrote last Wednesday March 11th at 4pm: “Bear Case Thursday: Begins on the failure of 6819”. Last Thursday morning, price picked its path, and down we went going elevator down and beginning a multi-week period of sell bounces. Readers know however that ES does...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3308 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=6524.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6524.0=swept_lost_low; 6532.0=current_price_context; 6623.0=current_price_context
- Time mentions: 4pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We then sold to 6524 low of day. This then setup a quality Failed Breakdown in the last half hour of trading. I wrote yesterday at 4pm: “Failed breakdowns of 6532 are an attractive entry and this zone was a big low from September 2025.” We recovered this in the last half hour and back up we went. Bulls will need to get over 6623 next wek to start the proc...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3356 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=6635.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6635.0=actual_setup_level
- Time mentions: 10:30AM
- S/R coincidence: 6635.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I was still holding a 10% long runner from the 10:30AM 6635 (March 8th major low) Failed Breakdown we saw yesterday. I confirmed this at the close yesterday, stating: “I am holding my 10% long runner still from the ~10:30AM 6635 Failed Breakdown today and this was a very choppy region which I discuss more about above. “
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: render ES 1m from 2026-03-18T18:00:00-04:00 minus 60 minutes through 2026-03-18T21:20:00-04:00 plus 90 minutes; trap_low=6612.5; reclaim=2026-03-18T21:20:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3364 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=6658.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6658.0=swept_lost_low; 6689.0=current_price_context; 6813.0=current_price_context
- Time mentions: 7pm
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw this sequence to start off this week on Sunday evening. Gap down and rapid elevator down flush to 6658. As always, we then wait for the Failed Breakdown and squeeze. In this case (as I discussed on Friday and yesterday) the Failed Breakdown would be on the recovery of 6689. ~6689 was a big shelf of lows all day Friday. We recovered it by 7pm Sunday...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3366 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: actual_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6623.0=current_price_context; 6635.0=current_price_context
- Time mentions: 9am
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then the rest of the day Wednesday? We began another elevator down sell and this continued into Thursday morning ultimately down to ~6623 by 9am and we spent all Thursday morning testing/flushing this. As always, a sell like Wednesday though would resolve with a squeeze but only when we get a Failed Breakdown. As I discussed yesterday, that Failed Breakdo...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3368 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=6608.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6608.0=swept_lost_low; 6612.0=current_price_context; 6647.0=current_price_context
- Time mentions: 6:30AM, 6:35AM, 9:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Then overnight? Restart the cycle. We went elevator down from 6680s down to 6608 by 6:30AM. From there? The usual - time for a Failed Breakdown and squeeze. By 6:35AM ES recovered the Thursday 6612 daily low, and we were off to 6647 by 9:30AM.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3370 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6524.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6524.0=swept_lost_low; 6532.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Rinse and repeat after that. Elevator down to 6524 low of day. From there? You guessed it. We recovered the major September 2025 low at ~6532 (Failed Breakdown) and ripped into the close.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3378 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=6716.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6815.0=current_price_context; 6716.0=swept_lost_low; 6635.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The basic theme heading into today was that bears retained control in ES. In ES, bears only take control when a significant, well-tested, previously defended support shelf fails. This originally occurred last Thursday - one week ago - when ES lost a 3 day support shelf up at 6815-19. At that point, bounces are likely to be sold until that shelf recover...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3380 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level; 6647.0=current_price_context
- Time mentions: 6:30AM
- S/R coincidence: 6612.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: As we will see below and referenced above, early this morning ES put in a big Failed Breakdown of Thursday’s 6612 daily low at 6:30AM giving us the trigger to rally, and we worked up to 6647. We were unable to get close to (or recover) any major structure that would shift the sell bounce regime and we progressed downward afterwards.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: render ES 1m from 2026-03-19T04:25:00-04:00 minus 60 minutes through 2026-03-19T04:41:00-04:00 plus 90 minutes; trap_low=6596.0; reclaim=2026-03-19T04:41:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3396 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6635.0=current_price_context
- Time mentions: 10:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We closed up after a big rally (with the most recent trigger being 10:30AM yesterday Failed Breakdown of the March 8th 6635 low. I expanded on this in great detail yesterday. There was little for me to do from here.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3424 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=6669.0; invalidation=none; target/response=none
- Level roles: 6663.0=current_price_context; 6669.0=non_acceptance_threshold
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Rememeber the non-acceptance protocol automatically activates when price recovers the significant low (6663) by 5 points (6669) and holds at or above 6669 for a few minutes. The non-acceptance protocol typically triggers for shallow (under 10 point flush of the significant low) and fast Failed Breakdowns, but you can use it for any Failed Breakdown. Typic...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3428 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Friday Morning and the 6612 Thursday Daily Low Failed Breakdown
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3432 `needs_bigger_crop`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=6612.0; swept/lost=6608.0, 6612.0; recovered=6612.0; non_acceptance=6617.0; invalidation=none; target/response=none
- Level roles: 6612.0=actual_setup_level+swept_lost_low+recovered_level; 6604.0=current_price_context; 6608.0=swept_lost_low; 6617.0=non_acceptance_threshold; 6620.0=current_price_context
- Time mentions: 6:30AM, 6:10AM, 6:33PM
- S/R coincidence: 6612.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_planned_setup
- Source: 1) Around 6:30AM, ES got an absolutely classic, bread-and-butter Failed Breakdown of yesterday’s 6612 daily low. I provided this setup to readers yesterday when I wrote: “Alternatively, the Failed Breakdown of today’s daily low at 6612 is also actionable. Bonus if we tag 6604 on this.” At 6:10AM, ES flushed 6612 down to 6608. Why is 6612 an actionable low...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: render ES 1m from 2026-03-19T04:32:00-04:00 minus 60 minutes through 2026-03-19T04:41:00-04:00 plus 90 minutes; trap_low=6607.0; reclaim=2026-03-19T04:41:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3434 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6634.0=current_price_context; 6608.0=current_price_context
- Time mentions: 7:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 2) The other thing I noticed is that my 10% long runner from yesterday obviously trailed out overnight since we made a new low and I had it stuck under the daily low as usual. When I first checked price at 7:30AM, we were 6634, and I decided to take the Failed Breakdown at this point. Remember Failed Breakdowns are valid as long as the lowest low of the F...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3449 `needs_bigger_crop`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=6612.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6623.0=current_price_context; 6612.0=actual_setup_level; 6604.0=current_price_context
- Time mentions: 10am
- S/R coincidence: 6612.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_planned_setup
- Source: Around 10am, ES dipped again back below 6623 and since we fell several points under my break-even, I cut my runner here, willing to re-enter if we got another Failed Breakdown. As I wrote yesterday: “Alternatively, the Failed Breakdown of today’s daily low at 6612 is also actionable. Bonus if we tag 6604 on this.”
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: render ES 1m from 2026-03-19T04:25:00-04:00 minus 60 minutes through 2026-03-19T04:41:00-04:00 plus 90 minutes; trap_low=6596.0; reclaim=2026-03-19T04:41:00-04:00

### data\research\mancini\The Longer Mancini Logs.txt:3453 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6608.0=current_price_context; 6612.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: This held almost exact. I didn’t long here, opting to wait for the Failed Breakdown as usual which would be on recovery of 6608/6612 as stated above.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3455 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6612.0=current_price_context; 6608.0=current_price_context
- Time mentions: 10am, 6:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Now note that while the 6612 low was still there (yesterday’s daily low) as of 10am we had a more local low just to the left at 6608. As discussed above, at 6:30AM ES set a 38 point low. This meets the criteria of a significant low which we would want to trade the flush and recovery of.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3457 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: planned_setup
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6608.0=current_price_context; 6612.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Since 6608 and 6612 were nearby though, it is best to wait for both to clear to engage in a Failed Breakdown.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3479 `needs_bigger_crop`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: actual_recap
- Levels: setup=6524.0; swept/lost=6476.0, 6524.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6532.0=current_price_context; 6524.0=actual_setup_level+swept_lost_low; 6537.0=current_price_context; 6593.0=current_price_context; 6623.0=current_price_context; 6542.0=current_price_context; 6500.0=current_price_context; 6476.0=swept_lost_low; 6461.0=current_price_context; 6426.0=current_price_context
- Time mentions: 4pm, 3:35PM, 3:40PM
- S/R coincidence: 6524.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: In terms of lvls I’d bid direct: Heading into the close today we triggered a very high quality Failed Breakdown. I wrote yesterday at 4pm: “Failed breakdowns of 6532 are an attractive entry and this zone was a big low from September 2025.” 3:35PM, ES sold to 6524. By 3:40PM, we ripped through 6532 and I decided to take the long here via the non-acceptance...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3483 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=6532.0; swept/lost=6524.0, 6532.0, 6591.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6532.0=actual_setup_level+swept_lost_low; 6524.0=swept_lost_low; 6591.0=swept_lost_low; 6623.0=current_price_context; 6648.0=current_price_context; 6671.0=current_price_context; 6690.0=current_price_context; 6716.0=current_price_context
- Time mentions: none
- S/R coincidence: 6532.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: Bull case tomorrow: Same drill. Late today, ES put in a classic Failed Breakdown. We lost the ~6532 low from September 2025 down to 6524, recovered, and ripped. While a Failed Breakdown starts every major rally, bears still control and in order to turn this Failed Breakdown into a sustained leg up rather than a sellable bounce, bulls need to start recover...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3485 `negative_control`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6524.0=current_price_context; 6624.0=current_price_context; 6618.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case Monday: Resumes under 6524. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has mastere...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3487 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=6532.0; swept/lost=6524.0, 6532.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6532.0=actual_setup_level+swept_lost_low; 6524.0=swept_lost_low; 6591.0=current_price_context; 6623.0=current_price_context; 6716.0=current_price_context
- Time mentions: none
- S/R coincidence: 6532.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_context_recap
- Source: In summary for Monday: Late today, ES put in a classic Failed Breakdown. We lost the ~6532 low from September 2025 down to 6524, recovered, and ripped. The task for bulls now is to make something of this and start recovering major previously lost support shelves. My general lean is ES can see 6591, dip then tackle 6623. If that clears, we can start a leg ...
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3503 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7378.0=current_price_context; 7368.0=current_price_context; 7345.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: shelf failed breakdown, 7378 controlled sell or 7368/7378 recovery, 7345 slow
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\The Longer Mancini Logs.txt:3504 `data_only`

- Context: After Bounces Got Sold All Week, Is SPX Ready To Sustain A Bounce Next Week? March 23 Plan | pub=2026-03-20 | plan=2026-03-23
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 7337.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: sell only, 7337 prior-low failed breakdown.
- Nearest support context: line 3477: Supports are: 6567, 6554, 6542 (major), 6536, 6524 (major), 6519, 6512, 6507, 6500 (major), 6492 (major), 6487, 6482, 6476 (major), 6466, 6461(major), 6453, 6446, 6437 (major), 6426 (major), 6417, 6410 (major), 6400, 6393, 6386 (major).
- Nearest resistance context: line 3481: Resistances are: 6572, 6577, 6584, 6592 (major), 6597 (major), 6609, 6614, 6623 (major), 6629, 6632, 6638, 6648 (major), 6656, 6662 (major), 6665, 6671 (major), 6674, 6685, 6690 (major), 6696, 6707, 6716 (major), 6722 (major), 6727, 6734 (major), 6743, 6751, 6755, 6766-70 (major), 6776, 6786 (major), 6793, 6803 (major), 6808, 6815-19 (major), 6823, 6828, ...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-03-16, 2026-03-17, 2026-03-18, 2026-03-19, 2026-03-20, 2026-03-23, 2026-03-24

### data\research\mancini\methodology.txt:67 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 9) My core pattern is the failed breakdown/breakout, and this comprises over 70% of my entries. Very important information on failed break down strategy found in this newsletter. Below are real time examples of the pattern from prior newsletters.
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:74 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Institutions have a set bag of tricks they use to enter the market, and the failed breakdown is #1 on that list. If you want to enter with enormous size, you need liquidity, and to find liquidity, you have to hunt for it. Fortunately for institutions, liquidity hides in very predictable spots (and it just so happens to be the spots that most retail trader...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:76 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The average retail trader loses because they constantly get trapped. They chase a long based a “breakout” with FOMO, and it reverses, they chase a short based on “breakdown” with FOMO, and it reverses. They put in a stop in, and it gets flushed, then price rallies etc. This is how institutions make money - they seek liquidity, and if you cannot clearly se...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:80 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 1) Price must put in a significant low. This is the most important criteria and if this is not present, there is no Failed Breakdown. A significant low is ideally the prior days low and this is the gold standard. Absent this, a major multi-hour low can work, provided it goes 20-30+ points. Absent this, a cluster of lows can also work. It cannot be any ran...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:84 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=6765.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6765.0=swept_lost_low
- Time mentions: 1:30PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 3) Price puts in a convincing loss of that low, enough to trap shorts and run stops on longs. It should look quite dramatic in real-time, as if you can see traders being trapped. The size of the flush does not matter, but I do put them in two camps. I consider <20 point Failed Breakdowns to be “shallow Failed Breakdowns”, and >20 points to be “deep Failed...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:86 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 4) Price reclaims the low and we can enter but we need to see something called acceptance first. The golden rule for Failed Breakdowns is if you rush, you lose. This is especially true for deeper Failed Breakdowns. If you just chase in long, you will get trapped, price will selloff, stop you out, then resume higher later without you. We need to see what I...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:88 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Generally the deeper the Failed Breakdown (>20 point flush) and the lower the volatility, the longer it takes. Conversely, the shallower the Failed Breakdown (<20 points) and higher the volatility, the quicker it takes. The average time for acceptance may take something like 5-10 minutes for a very shallow, high volatility Failed Breakdown (think under 10...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:96 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The Non-Acceptance Protocol: There will be some occasions where price sees 0 acceptance. This is rare, but is especially true when volatility is extreme and the Failed Breakdown is very shallow. In these cases, price will just rip through the low and keep going (often recovering the low then squeezing 10+ points instantly) with no pause at all for accepta...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:105 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: For this setup, the stop goes several points below the lowest low (perhaps an average 5 points for me). The setup is considered valid until the lowest low of the Failed Breakdown fails. The buffer used will vary depending on context (it is why screen time is invaluable). Below are some examples of how this looks both in its “textbook” variety, and then in...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:134 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Therefore the difference between a Failed Breakdown and Level Reclaim is a Failed Breakdown has a singular low or cluster of lows that flushes rapidly, traps, recovers. A Level Reclaim is when price forms an S/R line, and recovers it. Unlike with Failed Breakdowns, these are much slower. Failed Breakdowns price slingshots below a low and pops above. A Lev...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:141 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Level Reclaims are hard because you need to know how to chart horizontal lines. With Failed Breakdowns you don’t - you just need to be able to spot a significant low. When it comes to entry on Level Reclaims, one can just follow the same requirements as a Traditional Failed Breakdown (wait for acceptance, then long the recovery).
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:164 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: 11) A third setup of mine is the Breakdown Trade. As a warning, these trades are difficult - they take skill, plenty of screen time, and have a low win rate. When they work though - they payout big. They fail often because most breakdowns are failed breakdowns (which is why failed breakdowns are my top setup). In order to reduce to the risk of being caugh...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:166 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: When looking to take a trade based on this - patience is the necessary condition. Acceptance takes time and almost always there are many actionable trades *during* the acceptance process. For example, if price hits a support, one could try the long on the first test. It may go down up level for a profit. Then it may return to the level again, and try to b...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:172 `negative_control`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: 2) Wait for a bounce and/or failed breakdown at the zone immediately before you short. You cannot just rush into breakdown shorts or you will get trapped. What is the best way to avoid getting caught in a failed breakdown? Have one already having taken place at the level of interest. If no failed breakdown is present, a bounce at the zone is also sufficie...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:179 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We can see in the above diagram all the pieces: An obvious support level, a bounce and/or Failed Breakdown at the level immediately prior to shorting, then one places the trigger beneath all the structure at the zone. Obviously, they won’t always look like the above diagram, but this is the archetypal example to demonstrate the general concept of seeing b...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:181 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Very important: These types of trades represent a small % of my overall trades (under 10%), and are also the lowest win rate of the types of trades I do. These trades work best in very strongly up-trending markets, or very strongly down-trending markets. This type of trade takes tons of screen time and skill to execute well, and you can expect a “high cos...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\methodology.txt:202 `data_only`

- Context: My Trade Methodology - Fundamentals | pub=None | plan=None
- Source mode: methodology_definition
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: none
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Mode 2=range bound action. This is most of the price action. In Mode 2, price picks a range, and bulls and bears are generally in balance, with one side typically slightly favored depending on the underlying trend. Mode 2 is characterized by traps, lack of follow through, and indecision - the exact opposite of Mode 1. In Mode 2, failed breakdowns are your...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: none

### data\research\mancini\parsing text.txt:6 `needs_bigger_crop`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: actual_recap
- Levels: setup=6848.0; swept/lost=6847.25; recovered=none; non_acceptance=none; invalidation=none; target/response=6884.0
- Level roles: 6848.0=actual_setup_level; 6847.25=swept_lost_low; 6884.0=target_or_response; 6898.0=current_price_context; 6913.0=current_price_context; 6925.0=current_price_context; 6954.0=current_price_context; 6849.0=current_price_context
- Time mentions: 4pm, 9:30AM, 10:05AM
- S/R coincidence: 6848.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: One of those cycles is ES goes elevator down in a vertical flush cutting through every support. Then, it flushes a big low, traps shorts, recovers, and price rips. Often, these lows will be located at support of a range of some kind. We saw the exact same dynamic on Friday just passed. I wrote last Thursday at 4pm: “The very obvious trade here is the Fail...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:8 `needs_bigger_crop`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: actual_recap
- Levels: setup=6832.0; swept/lost=6822.0, 6828.0, 6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=actual_setup_level+swept_lost_low; 6822.0=swept_lost_low; 6828.0=swept_lost_low
- Time mentions: 4pm, 9:30AM
- S/R coincidence: 6832.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match
- Source: The task today was for ES to fill out this range more, but as always, we’d need a Failed Breakdown to provide us our entries. I wrote yesterday at 4pm: “The only possible option here would be a Failed Breakdown of today’s daily low which is at 6832 now. If we can flush that (perhaps down to 6822) and recover, this is a possible long.” At 9:30AM, we swept ...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:36 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=6849.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6849.0=actual_setup_level
- Time mentions: 11:25AM
- S/R coincidence: 6849.0=coincides_partially
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: Heading into today, I was still holding my 10% long runner from the 11:25AM 6849 Failed Breakdown we had yesterday. I confirmed this at the close yesterday, stating: “My most recent entry was the 6849 Failed Breakdown we had at 11:25AM today.”
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:42 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: actual_recap
- Levels: setup=none; swept/lost=6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6890.0
- Level roles: 6865.0=current_price_context; 6828.0=current_price_context; 6832.0=swept_lost_low; 6890.0=target_or_response
- Time mentions: 9:30AM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We saw precisely this today in the morning around 9:30AM. ES went rapidly elevator down selling from 6865 to 6828. In doing so though, it lost the Monday 6832 daily low by a few points. It almost immediately recovered that low (Failed Breakdown) and we we ripped higher to 6890+. You can see the whole sequence: A fast, vicious flush lower that trapped bear...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:78 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6849.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: The Level Reclaim does not have this. Rather, the Level Reclaim involves ES recovering a clear horizontal support/resistance trendline. Instead of there being a low that sweeps, traps, and recovers like the Failed Breakdown, here we have a clear classical horizontal trendline. This is what we had at 6849. It was a clear support line last Tuesday, Thursday...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:101 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=6832.0; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=actual_setup_level
- Time mentions: 9:35AM
- S/R coincidence: 6832.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, no_source_stated_swept_low_below_setup, source_mode_context_recap
- Source: The 9:35AM Failed Breakdown of Yesterday’s 6832 Daily Low
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:105 `needs_bigger_crop`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: planned_setup
- Levels: setup=6832.0; swept/lost=6822.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=actual_setup_level; 6822.0=swept_lost_low
- Time mentions: 4pm
- S/R coincidence: 6832.0=coincides_cleanly
- Chart/window: none
- Blockers: no_existing_chart_window_match, source_mode_planned_setup
- Source: I wrote yesterday at 4pm: “The only possible option here would be a Failed Breakdown of today’s daily low which is at 6832 now. If we can flush that (perhaps down to 6822) and recover, this is a possible long but be sure to take profits level to level.”
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:107 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=none; swept/lost=6828.0, 6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=swept_lost_low; 6828.0=swept_lost_low
- Time mentions: 9:36PM
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: We swept 6832 down to 6828, and by 9:36PM, recovered 6832. This was an instant, hyper fast Failed Breakdown. As a result, there was no time or space for either of the two acceptance types discussed above and the non-acceptance protocol immediately activated.
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:134 `needs_bigger_crop`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: planned_setup
- Levels: setup=6832.0, 6880.0; swept/lost=6871.0, 6893.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6832.0=actual_setup_level; 6925.0=current_price_context; 6850.0=current_price_context; 6893.0=swept_lost_low; 6878.0=current_price_context; 6880.0=actual_setup_level; 6871.0=swept_lost_low; 6822.0=current_price_context; 6828.0=current_price_context
- Time mentions: 9:35AM, 4am, 3:15PM, 11:30AM
- S/R coincidence: 6832.0=coincides_cleanly; 6880.0=coincides_partially
- Chart/window: none
- Blockers: multi_setup_row_split_required, no_existing_chart_window_match, source_mode_planned_setup
- Source: In terms of lvls I’d bid direct: I am still holding my 10% long runner from the 9:35AM Failed Breakdown of yesterday’s 6832 daily low we saw this morning. We are closing up today after a nice run higher and readers know what I’m going to say here: My least favorite time to trade is after a large rally. Why? I am a Failed Breakdown trader. My edge shows up...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:138 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=none; swept/lost=6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=6935.0
- Level roles: 6850.0=current_price_context; 6925.0=current_price_context; 6832.0=swept_lost_low; 6871.0=current_price_context; 6935.0=target_or_response; 6953.0=current_price_context; 6973.0=current_price_context; 6893.0=current_price_context; 6908.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: Bull case tomorrow: No change. All week ES has been rangebound with 6850-53 support now, and resistance up at 6925. Today, ES sold below support of that range, lost yesterday’s 6832 daily low, trapped shorts, and ripped up the range. This is probably the last good chance bulls get at sticking a move as this was a dramatic Failed Breakdown. The bull case f...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:140 `negative_control`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: negative_control
- Levels: setup=none; swept/lost=none; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6842.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: source_marks_no_trigger_or_non_fbd
- Source: Bear case tomorrow: 6850-53 must fail. These types of level loss shorts below a support are called breakdown trades. My core edge is failed breakdowns, and the reason is this is an edge is the vast majority of break downs (80%) trap. I do not take these trades personally. They take great skill to execute, and even when done well by a trader who has master...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26

### data\research\mancini\parsing text.txt:142 `data_only`

- Context: Another Day In The Same Range For SPX. Are We Close To Breakout? February 25 Plan | pub=2026-02-24 | plan=2026-02-25
- Source mode: context_recap
- Levels: setup=none; swept/lost=6832.0; recovered=none; non_acceptance=none; invalidation=none; target/response=none
- Level roles: 6850.0=current_price_context; 6925.0=current_price_context; 6832.0=swept_lost_low; 6935.0=current_price_context; 6953.0=current_price_context
- Time mentions: none
- S/R coincidence: none
- Chart/window: none
- Blockers: no_actual_setup_level_extracted
- Source: In summary for tomorrow: All week ES has been rangebound with 6850-53 support now, and resistance up at 6925. Today, ES sold below support of that range, lost yesterday’s 6832 daily low, trapped shorts, and ripped up the range. This is probably the last good chance bulls get at sticking a move as this was a dramatic Failed Breakdown. My general lean is ca...
- Nearest support context: line 132: Supports are: 6893 (major), 6888, 6878 (major), 6871 (major), 6866, 6857, 6850-53 (major), 6843, 6837, 6832 (major), 6828, 6822 (major), 6813, 6807, 6795 (major), 6790, 6782 (major), 6777, 6772 (major), 6763, 6759 (major), 6752, 6747 (major), 6736 (major), 6732, 6727, 6720, 6716, 6710 (major), 6704 (major), 6695, 6690 (major), 6684, 6681-77 (major), 6672,...
- Nearest resistance context: line 136: Resistances are: 6899, 6904, 6907 (major), 6912, 6918, 6925 (major), 6935, 6942, 6953 (major), 6958 (major), 6967, 6973 (major), 6982 (major), 6987, 6992 (major), 6996, 7002, 7006 (major), 7014, 7017 (major), 7022, 7026, 7036 (major), 7043, 7052, 7058 (major), 7067, 7081, 7088 (major), 7101, 7109 (major), 7112, 7120 (major), 7132, 7138 (major). As readers...
- Required crop: generate from ES 1m session around source-stated event time; nearby session files available: 2026-02-23, 2026-02-25, 2026-02-26
