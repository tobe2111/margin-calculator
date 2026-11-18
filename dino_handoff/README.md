# 공룡 키트 인수인계 파일 (2026-11-18)
판매용 코드가 아니라, 공룡 키트 작업을 새 세션으로 옮기기 위한 파일이에요. 합치지(merge) 마세요.

나뉜 zip 다시 합치기:
```bash
cd dino_handoff
for f in 티렉스_출력파일_rev6.3 매머드_출력파일_v4.3 랩터_키트_v8; do cat $f.zip.part* > $f.zip; done
```
먼저 `인수인계_기준_스크립트.zip`을 풀어 `notes/인수인계.md`를 읽으세요.
