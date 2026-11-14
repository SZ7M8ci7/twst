# T3 small-effect calibration (prospective; NOT an adoption gate)

Public small search showed +4.181/+3.094/+1.771% throughput, below the predeclared mean 5% threshold. No full benchmark, no changed threshold. This follow-up asks whether a small fixed-host speed difference is distinguishable from paired measurement drift. Even a real 3% effect does not pass the 5% end-to-end gate.

## Frozen inputs
Exactly five already public catalog-derived dormitory-only frozen candidates (current fire/water BASIC, wood/no-element DEFENCE, all-element ATTACK). Source is the committed synthetic observation-equivalence fixture, not any private collection, nrc19 report, or the old private-path fixed-work script. Only unused target/tolerance keys removed. The payload includes exact fixture bytes/provenance and verifies names against each source public catalog, hashes and no mutation. No new candidate selection or tuning from test results.

## Independent processes, three VMs
Each VM runs a T1 pilot, then three wholly separate Node/Vite source processes: A=T1, B=T1 null, C=T3-on-T1. Source order is ABC/BCA/CAB for replicate0/1/2. Cases rotate by replicate too. Each source is serial, no concurrent source processes on a VM; three standard independent Ubuntu24.04 VMs. Existing master remains untouched. Exactly three replicate jobs. Expected job total 4–6 minutes including setup; timeout12min.

## Workload
Pilot uses T1 only. At least 0.75s warmup per kernel then ~0.25s calibration, rounding counts up to a block. One common fixed count per case/kernel is used by A/B/C, targeting 6s warm-trial, 3s prepare-only, 3s prepare+one cold trial. Counts capped for runaway safety; a measured kernel below2s is flagged insufficient duration, not silently called precise. Warmup and pilot are not included in timing results. No counts tuned based on C results.

Three separately measured kernels, five cases each:
1. Prepared-host ordinary trial loop: one prepare, sufficient repeated-trial warmup; prepared runtime/cache cost amortized. Same seed stream and policy for all sources. No trial selection change.
2. Prepare-only: repeated prepare of the frozen input/candidate; explicitly excludes subsequent lazy first-trial cache population.
3. Prepare+one ordinary trial: rebuild runtime each iteration, then a fixed seed trial; captures lazy cold-cache costs omitted by prepare-only. It is a separate workload, not an estimate obtained by subtracting noisy timings.

CPU user+system and wall duration, count and per-operation cost are recorded per kernel. Explicit GC only before timing/warmup where available, never inside measured loop. Host/Vite startup is recorded separately and excluded. Timed loops consume a deterministic score checksum; full trial+replay audit runs outside timed loops (128 exact seeds including logged outputs, first4 replay) and must match A/B/C. Inputs/candidates unchanged assertion. Each process persists each completed case.

## Report, not selective claims
Report all case/kernel paired ratios: B/A null and C/geomean(A,B), arithmetic/geometric summaries, all three individual replicate values, CPU and wall separately, warmup/count/source/harness/fixture hashes and full digest equality. No wins-only aggregation, no silent failed-case dropping, no significance/p-value claim from3VM, no conversion of microkernel improvement into overall search speed. Wrong hash/digest or failed/null duration invalidates the corresponding result. Report prepare regressions even if warm trials improve. Starting requires coordinator approval; payload preparation itself does not launch Actions.
