# Hermes Mancini Viability Summary

Review-only. Trading authority: none.

Packets: 104

## Status

research_viable_not_strategy_viable

## Why

- This is a pre-Hermes packet/outcome summary.
- Pattern evidence exists in multiple packets.
- Universal close count, stop formula, and volume threshold remain unsupported.
- Sample is still research-only and must not be promoted to NinjaScript.

## Aggregate

- flush_buckets: `{"deep_20_plus": 12, "large_10_to_20": 20, "medium_5_to_10": 28, "missing": 2, "shallow_under_5": 42}`
- acceptance_buckets: `{"moderate_2_to_3": 15, "strong_4_to_10": 13, "very_strong_10_plus": 63, "weak_0_to_1": 13}`
- reclaim_time_buckets: `{"10_plus": 33, "2_to_3_5": 10, "3_5_to_10": 34, "missing": 27}`
- unsupported_assumptions: `{}`
- hypotheses_to_test: `{}`
- outcomes_by_reclaim_time_bucket: `{"10_plus": {"avg_mae_15m": 3.4924, "avg_mae_60m": 7.2576, "avg_mfe_15m": 5.1136, "avg_mfe_60m": 8.6439, "count": 33, "hit_2pt_15m_rate": 0.7879, "hit_2pt_60m_rate": 0.9091, "hit_4pt_15m_rate": 0.6061, "hit_4pt_60m_rate": 0.7273}, "2_to_3_5": {"avg_mae_15m": 2.9, "avg_mae_60m": 8.0, "avg_mfe_15m": 7.9, "avg_mfe_60m": 10.2, "count": 10, "hit_2pt_15m_rate": 0.9, "hit_2pt_60m_rate": 1.0, "hit_4pt_15m_rate": 0.6, "hit_4pt_60m_rate": 0.9}, "3_5_to_10": {"avg_mae_15m": 4.9338, "avg_mae_60m": 7.8971, "avg_mfe_15m": 8.9338, "avg_mfe_60m": 14.4559, "count": 34, "hit_2pt_15m_rate": 0.8529, "hit_2pt_60m_rate": 0.9706, "hit_4pt_15m_rate": 0.7353, "hit_4pt_60m_rate": 0.8529}, "missing": {"avg_mae_15m": 9.2609, "avg_mae_60m": 12.9239, "avg_mfe_15m": 3.7935, "avg_mfe_60m": 8.4783, "count": 27, "hit_2pt_15m_rate": 0.5217, "hit_2pt_60m_rate": 0.6522, "hit_4pt_15m_rate": 0.2609, "hit_4pt_60m_rate": 0.5217}}`
- outcomes_by_acceptance_bucket: `{"moderate_2_to_3": {"avg_mae_15m": 7.15, "avg_mae_60m": 10.95, "avg_mfe_15m": 3.3333, "avg_mfe_60m": 7.7167, "count": 15, "hit_2pt_15m_rate": 0.5333, "hit_2pt_60m_rate": 0.8, "hit_4pt_15m_rate": 0.3333, "hit_4pt_60m_rate": 0.5333}, "strong_4_to_10": {"avg_mae_15m": 8.8269, "avg_mae_60m": 11.7692, "avg_mfe_15m": 3.7115, "avg_mfe_60m": 6.2692, "count": 13, "hit_2pt_15m_rate": 0.7692, "hit_2pt_60m_rate": 0.7692, "hit_4pt_15m_rate": 0.4615, "hit_4pt_60m_rate": 0.5385}, "very_strong_10_plus": {"avg_mae_15m": 3.2924, "avg_mae_60m": 6.3347, "avg_mfe_15m": 8.4576, "avg_mfe_60m": 13.2458, "count": 63, "hit_2pt_15m_rate": 0.9153, "hit_2pt_60m_rate": 0.9492, "hit_4pt_15m_rate": 0.7458, "hit_4pt_60m_rate": 0.8983}, "weak_0_to_1": {"avg_mae_15m": 8.3654, "avg_mae_60m": 14.9423, "avg_mfe_15m": 3.1923, "avg_mfe_60m": 7.3077, "count": 13, "hit_2pt_15m_rate": 0.3077, "hit_2pt_60m_rate": 0.7692, "hit_4pt_15m_rate": 0.1538, "hit_4pt_60m_rate": 0.4615}}`
- outcomes_by_flush_bucket: `{"deep_20_plus": {"avg_mae_15m": 6.4583, "avg_mae_60m": 9.6458, "avg_mfe_15m": 8.9167, "avg_mfe_60m": 10.5625, "count": 12, "hit_2pt_15m_rate": 1.0, "hit_2pt_60m_rate": 1.0, "hit_4pt_15m_rate": 0.9167, "hit_4pt_60m_rate": 0.9167}, "large_10_to_20": {"avg_mae_15m": 10.1389, "avg_mae_60m": 16.25, "avg_mfe_15m": 6.0972, "avg_mfe_60m": 9.8611, "count": 20, "hit_2pt_15m_rate": 0.5556, "hit_2pt_60m_rate": 0.6667, "hit_4pt_15m_rate": 0.4444, "hit_4pt_60m_rate": 0.5}, "medium_5_to_10": {"avg_mae_15m": 5.0714, "avg_mae_60m": 7.6786, "avg_mfe_15m": 6.4464, "avg_mfe_60m": 12.5, "count": 28, "hit_2pt_15m_rate": 0.6786, "hit_2pt_60m_rate": 0.8571, "hit_4pt_15m_rate": 0.5357, "hit_4pt_60m_rate": 0.6429}, "missing": {"avg_mae_15m": null, "avg_mae_60m": null, "avg_mfe_15m": null, "avg_mfe_60m": null, "count": 2, "hit_2pt_15m_rate": null, "hit_2pt_60m_rate": null, "hit_4pt_15m_rate": null, "hit_4pt_60m_rate": null}, "shallow_under_5": {"avg_mae_15m": 2.9286, "avg_mae_60m": 6.2381, "avg_mfe_15m": 5.75, "avg_mfe_60m": 9.9881, "count": 42, "hit_2pt_15m_rate": 0.8333, "hit_2pt_60m_rate": 0.9524, "hit_4pt_15m_rate": 0.5476, "hit_4pt_60m_rate": 0.8571}}`

## Next Tests

- Run packet builder over crop-ready events.csv rows, not only examples.csv.
- Bucket outcomes by reclaim time, especially 0-1, 2-3.5, 3.5-10, and 10+ minutes.
- Compare acceptance closes 1, 2-3, 4-10, and 10+ against post-entry MFE/MAE.
- Test trap candle volume ratio and wick/body as filters, not rules.
- Keep NinjaScript blocked until out-of-sample review-only evidence survives.

## Packet Rows

- `mancini-es1m:2026-03-26T1438:6530.0:effee829803a`: flush=5.75, acceptance_closes=5, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T1418:6536.0:096bb8a6111f`: flush=10.0, acceptance_closes=2, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T1249:6549.0:683fbec8ccbb`: flush=13.0, acceptance_closes=15, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T1230:6553.0:4f58e4879acd`: flush=3.0, acceptance_closes=13, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T1236:6558.0:72585b864680`: flush=14.5, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T1137:6564.0:7e7939aa5c11`: flush=3.25, acceptance_closes=2, reclaim_minutes=5.0, unsupported=[]
- `mancini-es1m:2026-03-26T1120:6572.0:fb363c650572`: flush=11.25, acceptance_closes=2, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-03-26T0436:6584.0:2f7344ae5faf`: flush=2.75, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-03-26T0443:6586.0:8e206cf24aab`: flush=4.75, acceptance_closes=3, reclaim_minutes=11.0, unsupported=[]
- `mancini-es1m:2026-03-26T0453:6588.0:beb16e5dfd08`: flush=3.75, acceptance_closes=16, reclaim_minutes=14.0, unsupported=[]
- `mancini-es1m:2026-03-26T0847:6603.0:bc2c035a94be`: flush=23.25, acceptance_closes=16, reclaim_minutes=7.0, unsupported=[]
- `mancini-es1m:2026-03-26T0848:6604.0:55519627098b`: flush=24.25, acceptance_closes=16, reclaim_minutes=8.0, unsupported=[]
- `mancini-es1m:2026-03-26T0853:6608.0:c67c979f0edc`: flush=28.25, acceptance_closes=5, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-03-26T0902:6616.0:9d4c7c7a02cc`: flush=15.0, acceptance_closes=2, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-03-26T0917:6617.0:55f735ad6a3e`: flush=10.25, acceptance_closes=1, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-04-05T1731:6582.0:db721cea1523`: flush=6.5, acceptance_closes=2, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-05T1741:6586.0:d43405f4c313`: flush=6.5, acceptance_closes=1, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-04-05T1904:6597.0:aee7391c3ff5`: flush=15.0, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-05T1926:6603.0:efc98bbb7e7b`: flush=5.0, acceptance_closes=3, reclaim_minutes=9.0, unsupported=[]
- `mancini-es1m:2026-04-05T1958:6608.0:b77acc61c92f`: flush=2.5, acceptance_closes=16, reclaim_minutes=7.0, unsupported=[]
- `mancini-es1m:2026-04-05T2112:6616.0:3b7eb835bf6a`: flush=8.75, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-05T2113:6620.0:6d688467940c`: flush=12.25, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-10T1147:6848.0:d3064454d056`: flush=1.0, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-09T1759:6853.0:e3bac95e9756`: flush=2.0, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-09T2001:6861.0:dacbddf01129`: flush=3.0, acceptance_closes=15, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-04-10T0733:6873.0:af6d88df54c0`: flush=8.25, acceptance_closes=2, reclaim_minutes=21.0, unsupported=[]
- `mancini-es1m:2026-04-21T1447:7086.0:2d7d511f9423`: flush=1.0, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-21T1449:7095.0:091f29797a0f`: flush=10.0, acceptance_closes=3, reclaim_minutes=5.0, unsupported=[]
- `mancini-es1m:2026-04-21T1215:7104.0:6df217479a42`: flush=7.25, acceptance_closes=3, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-21T1210:7110.0:f2710359ef0d`: flush=13.25, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-21T1147:7116.0:0f18cf305c88`: flush=2.5, acceptance_closes=12, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-21T1008:7121.0:0b148c3c2717`: flush=0.25, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-21T1009:7125.0:f562bc70d863`: flush=4.25, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-04-21T1010:7126.0:111e25cf81f3`: flush=5.25, acceptance_closes=16, reclaim_minutes=5.0, unsupported=[]
- `mancini-es1m:2026-04-21T1012:7135.0:9f67b6e6810f`: flush=14.25, acceptance_closes=4, reclaim_minutes=7.0, unsupported=[]
- `mancini-es1m:2026-04-21T0838:7148.0:9781ace7a049`: flush=1.0, acceptance_closes=16, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-20T2033:7160.0:2e8a8600b9b6`: flush=2.5, acceptance_closes=16, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-04-21T1753:7121.0:ac4d423be8d1`: flush=None, acceptance_closes=16, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-21T1756:7121.5:782d3124881c`: flush=0.25, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-21T1756:7121.75:c16681604480`: flush=0.5, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-21T1851:7130.0:39f23eec3772`: flush=4.25, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-21T1913:7135.0:cca99af8e09a`: flush=4.75, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-21T2040:7140.0:0551de6999a3`: flush=5.0, acceptance_closes=3, reclaim_minutes=12.0, unsupported=[]
- `mancini-es1m:2026-04-22T1500:7170.0:252956aab912`: flush=8.0, acceptance_closes=7, reclaim_minutes=17.0, unsupported=[]
- `mancini-es1m:2026-04-23T1250:7086.0:c90c15dbaaf1`: flush=6.75, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-04-23T1256:7093.0:db705701d68a`: flush=13.75, acceptance_closes=16, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-04-23T1256:7097.0:30dca8a80e9c`: flush=17.75, acceptance_closes=16, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-04-23T1256:7105.0:761d36beed0e`: flush=25.75, acceptance_closes=16, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-04-22T1921:7130.0:f23775d2ceac`: flush=24.5, acceptance_closes=16, reclaim_minutes=5.0, unsupported=[]
- `mancini-es1m:2026-04-22T1921:7134.0:76d987f80906`: flush=28.5, acceptance_closes=16, reclaim_minutes=5.0, unsupported=[]
- `mancini-es1m:2026-04-28T0734:7149.0:2b460ce02af9`: flush=1.5, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-28T0715:7153.0:d91c655f2cd6`: flush=3.5, acceptance_closes=7, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-28T0644:7161.0:c75b9c1d69d2`: flush=5.75, acceptance_closes=5, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-28T0635:7167.0:cdd022159acb`: flush=10.25, acceptance_closes=2, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-28T0844:7177.0:51e1cd622b06`: flush=15.25, acceptance_closes=1, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-04-28T0607:7185.0:a8043403abe4`: flush=14.0, acceptance_closes=15, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-28T0607:7186.0:7ad322c914a2`: flush=15.0, acceptance_closes=15, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-28T0146:7193.0:b6415693fe3c`: flush=3.5, acceptance_closes=1, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-28T0238:7194.0:96d4228a6660`: flush=3.25, acceptance_closes=16, reclaim_minutes=11.0, unsupported=[]
- `mancini-es1m:2026-04-28T0041:7198.0:d939971877fb`: flush=2.0, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-04-28T0024:7204.0:f6db02e9ca73`: flush=8.0, acceptance_closes=6, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-29T1058:7149.0:b9ec03c29384`: flush=3.75, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-04-29T0836:7153.0:cdaddd20771f`: flush=3.5, acceptance_closes=9, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-29T0915:7161.0:270b307ee0f5`: flush=5.25, acceptance_closes=16, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-04-28T1916:7185.0:52a0c6aab282`: flush=4.5, acceptance_closes=1, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T0115:7136.0:5d5f8f04e0a3`: flush=2.25, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-04-30T0117:7137.0:7d4c8b457d6d`: flush=3.25, acceptance_closes=16, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-04-30T0120:7138.0:c1394dc0e7d2`: flush=4.25, acceptance_closes=16, reclaim_minutes=9.0, unsupported=[]
- `mancini-es1m:2026-04-30T0002:7145.0:269125268965`: flush=0.25, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-04-29T1717:7185.0:fcf59234d20c`: flush=27.25, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-29T1718:7186.0:88c265e86f37`: flush=27.0, acceptance_closes=16, reclaim_minutes=14.0, unsupported=[]
- `mancini-es1m:2026-04-29T1718:7187.0:99e6ef656ae8`: flush=28.0, acceptance_closes=9, reclaim_minutes=14.0, unsupported=[]
- `mancini-es1m:2026-04-29T1719:7188.0:27f9c20985cb`: flush=29.0, acceptance_closes=7, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T0714:7200.0:88a521f8add4`: flush=6.75, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T0727:7208.0:b6b4964d09eb`: flush=8.75, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-30T1233:7213.0:532a03df99ad`: flush=7.5, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T1233:7214.0:08789e63503b`: flush=8.5, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T1249:7221.0:97231e7109c1`: flush=6.5, acceptance_closes=2, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-04-30T1333:7234.0:3c00cd0b2ac2`: flush=4.0, acceptance_closes=16, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-04-30T1414:7244.0:9e791381d366`: flush=7.75, acceptance_closes=16, reclaim_minutes=14.0, unsupported=[]
- `mancini-es1m:2026-04-30T1427:7246.0:ddfe5aa99504`: flush=4.75, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-04-30T1825:7252.0:74a393d62e09`: flush=3.0, acceptance_closes=16, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-05-01T0834:7267.0:a3d3e3c826de`: flush=8.25, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-05-04T1111:7205.0:199efd553d12`: flush=5.5, acceptance_closes=16, reclaim_minutes=3.0, unsupported=[]
- `mancini-es1m:2026-05-04T1120:7212.0:2d56f81dd54c`: flush=12.5, acceptance_closes=16, reclaim_minutes=12.0, unsupported=[]
- `mancini-es1m:2026-05-04T0512:7220.0:076df8b9935e`: flush=6.25, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-05-04T0528:7228.0:217aa5f8067d`: flush=14.25, acceptance_closes=16, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-05-04T0535:7237.0:f2db83da0917`: flush=23.25, acceptance_closes=16, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-05-04T0535:7241.0:0e0167c301ae`: flush=27.25, acceptance_closes=16, reclaim_minutes=13.0, unsupported=[]
- `mancini-es1m:2026-05-04T0721:7252.0:69e875eda5ec`: flush=6.75, acceptance_closes=1, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-05-04T0850:7253.0:24c3fe3db25b`: flush=9.0, acceptance_closes=14, reclaim_minutes=12.0, unsupported=[]
- `mancini-es1m:2026-05-03T1930:7257.0:74d0631000c1`: flush=2.75, acceptance_closes=16, reclaim_minutes=9.0, unsupported=[]
- `mancini-es1m:2026-05-03T1904:7259.0:6763382fb035`: flush=2.0, acceptance_closes=13, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-05-03T1727:7264.0:b8318b611596`: flush=1.75, acceptance_closes=16, reclaim_minutes=4.0, unsupported=[]
- `mancini-es1m:2026-05-03T1716:7267.0:96410338307b`: flush=4.75, acceptance_closes=5, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-05-04T2128:7237.0:46b978839608`: flush=2.25, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-05-05T0201:7247.0:8438d65f7a79`: flush=3.25, acceptance_closes=16, reclaim_minutes=15.0, unsupported=[]
- `mancini-es1m:2026-05-05T0241:7253.0:f019439f6e21`: flush=7.25, acceptance_closes=2, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-05-05T0717:7266.0:8428d5cdb96c`: flush=9.75, acceptance_closes=2, reclaim_minutes=22.0, unsupported=[]
- `mancini-es1m:2026-05-05T0830:7267.0:bfed98aa1b3b`: flush=4.5, acceptance_closes=16, reclaim_minutes=6.0, unsupported=[]
- `mancini-es1m:2026-05-07T1345:7345.0:c93bcced7d15`: flush=None, acceptance_closes=16, reclaim_minutes=None, unsupported=[]
- `mancini-es1m:2026-05-07T1237:7355.0:3a8cb95abc7c`: flush=9.25, acceptance_closes=9, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-05-07T1237:7356.0:1f5e46c4d6f2`: flush=10.25, acceptance_closes=8, reclaim_minutes=10.0, unsupported=[]
- `mancini-es1m:2026-05-07T1118:7369.0:11031ff62a3f`: flush=3.25, acceptance_closes=1, reclaim_minutes=None, unsupported=[]
