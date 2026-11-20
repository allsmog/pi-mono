# CodeBoarding integration

Pi invokes the unmodified [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding)
runtime at commit `b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8` (package version 0.15.6).
`setup.py` installs that exact commit and its frozen dependency lock. The additional
`socksio==1.0.0` dependency allows upstream's HTTP clients to use configured SOCKS proxies.

The full analysis path uses CodeBoarding's own CLI. The static bridge imports its
`StaticAnalyzer`, `ClusteringService`, `ScopeAssembler`, canonical analysis writer,
and canonical analysis reader. It does not substitute a regular-expression scanner
or a fabricated language-model response. Static arrows are resolved call
relationships, not proof of runtime data propagation or taint tracking.

CodeBoarding is copyright (c) 2025 CodeBoarding, under the MIT license. Its complete
license is included in `CODEBOARDING_LICENSE`. The upstream checkout retains its
own license and third-party dependency notices.
