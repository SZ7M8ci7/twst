# T6 fixed-work current baseline/null calibration

Frozen currentbase ba08481a26f079b830bfcb29e1067da4c0897cf1, pureT6 7247ef54cee812e734b6279c7c0b834670d751ff. Only build-plugin headless deepwatch removal and its test patch. No T1/T3/T4 mix; no master/UI publish/merge; no score searchbenchmark.

Three VM independent processes, A=currentbase/B=samebaseNull/C=T6, rotated ABC/BCA/CAB. Exact prior public catalog dormitory10inputs (5subjects×cap0/20), original fixtureSHA256 40a7c850f70e22ac50a63e34465beec50494743336b2e1e240549a11d484c573. Structuralcap20=4owned×5, support0; no private data.

Common baseline pilot freezes counts for allsources before timing. Separate warm ordinarytrial, prepareOnly, prepare+firsttrial. Warmups excluded, same fixedseeds/work counts, CPU/wall raw retained. Audit128ordinary+4replays perinput/source, exactchecksums/digests, legality/realpositiveallocation mandatory. Min2sec perkernel or insufficient, never silently drop. Independentrunners3 not scoreproof.

Sourcehash covers src+build+viteconfig+package-lock before/after; oldsrc-only calibration hash was insufficient for T6 build-only patch and has been corrected before launch. Harness/driver/fixture bytes hash before/after too. Candidate sourceHash must differ frombase, A/B same. Purepatch verified against frozencommits. Allinput unchanged mandatory.

Prospective gate: only warmTrial or prepareTrial (not prepareOnly alone) with candidate gainpositive all3runners AND mean CPU/wall gain exceeding both abs(geomean(null)-1) and geomean(1+abs(null-1))-1 is worth nextperformance verification. For eachcap/CPUwall, if candidate meanratio<1 and loss exceeds either nullnoise measure, regressionflag; advancement requires bothcap noflag. Original and conservative nullmeasures both shown. Any inconclusive/noisy/adverse result stops advancement pending diagnosis. Passing means discuss nexttest only, not speed-to-score improvement/adoption.

Initial localsmoke failed due recovery textsave appending a trailingLF to publicfixture. Exact original bytes restored and Gitblob verified, not changing fixture content or expectedhash. Initialfailure log retained separately. Productionnot run until corrected realharness smoke and reviewpass. Allproduction failures/raw retained.
