# 🧭 Git 치트시트 — 형 전용

> 일단 `scripts\git_init.bat` 더블클릭해서 초기화부터 하고 이 문서 보자.
> **외울 거 3개, 당황하면 구조 5개.**  그게 다임.

---

## 📌 매일 쓸 3명령 (외워)

PPTX 폴더에서 cmd 또는 PowerShell 열고:

```bat
git add .                    # 바뀐 거 전부 담기
git commit -m "설명 한 줄"   # 스냅샷 만들기
git log --oneline            # 지금까지 한 거 보기
```

**언제 커밋해? → 뭔가 "의미있게" 끝낼 때마다.** 파일 10개 고쳤어도 의미가 하나면 커밋 하나. 겁내지 말고 자주 해라. 많을수록 좋아.

**커밋 메시지 예시:**
- `"editor.main.js 이벤트 핸들러 정리"`
- `"블럭 선택 버그 수정 — Shift+클릭 시 다중 해제 안 됨"`
- `"3번 슬라이드 레이아웃 Figma 스타일로 리뉴얼"`

---

## 🆘 당황할 때 구조 5명령

### 1. **"방금 커밋한 거 취소하고 싶어"**
```bat
git reset --hard HEAD~1
```
마지막 커밋 + 그 변경사항 전부 날림. **주의: 커밋 안 한 변경도 같이 날아감.**

### 2. **"1시간 전 상태로 돌려줘"**
```bat
git log --oneline
```
커밋 목록에서 원하는 해시 (앞 7자리) 찾고:
```bat
git reset --hard <해시>
```

### 3. **"파일 하나만 이전 상태로"**
```bat
git checkout HEAD -- engine/editor.js
```
그 파일만 마지막 커밋 상태로 복원. 다른 파일 안 건드림.

### 4. **"실험해보고 싶은데 메인은 지키고 싶어"**
```bat
git branch 실험
git checkout 실험
REM 이제 실컷 수정. 망하면 아래로 돌아옴:
git checkout main
git branch -D 실험          REM 실험 가지 통째로 버림
```

### 5. **"내가 뭐 바꿨는지 모르겠어"**
```bat
git status        REM 어떤 파일이 바뀌었는지
git diff          REM 구체적으로 뭐가 바뀌었는지
```

---

## 🏷️ 버전 태그 (v1.4 박을 때)

```bat
git tag -a v1.4.0 -m "설명"
git tag                       REM 태그 목록
git checkout v1.3.0          REM v1.3 시점으로 잠깐 돌아가보기
git checkout main             REM 현재로 복귀
```

---

## 🚫 하면 안 되는 것

1. **`git push --force`** — 누가 시키기 전엔 절대 X (GitHub 쓸 때 한정 위험)
2. **`git rebase`** — 일단 안 써도 됨
3. **.git 폴더 손으로 수정** — 망함

---

## 🔄 기존 `.bak` 시스템과의 관계

- 이제 **모든 `.bak` 파일은 Git 이 대체**.
- `scripts/rollback_split.sh` 같은 커스텀 롤백 스크립트도 **`git reset --hard <해시>`** 로 충분.
- 지금 존재하는 `.bak` 들은 당분간 유지 (안전벨트). Git 한 달 써보고 안정되면 전부 삭제.
- `_milestones/` 폴더는 .gitignore 에 있어서 Git 이 무시. 나중에 삭제해도 됨.

---

## 📝 내가 (Claude) 앞으로 할 것

형이 요청한 작업 끝날 때마다:
1. `git status` 로 변경 확인
2. 형에게 "이거 커밋할까?" 또는 "바로 커밋하고 테스트해줘" 물어봄
3. 커밋 메시지 제안 (형이 고치거나 OK 하면 진행)

형은 그냥 "ㄱㄱ" 만 하면 됨.

---

## 💡 Git 용어 한 줄 정리

| 용어 | 뜻 |
|---|---|
| repository / 레포 | Git 이 관리하는 폴더 (=PPTX) |
| commit / 커밋 | 시점 스냅샷 |
| branch / 브랜치 | 평행 우주 (실험 가지) |
| HEAD | 지금 내가 있는 커밋 |
| stage / add | 커밋에 포함할 변경 찜하기 |
| tag | 커밋에 붙이는 별명 (v1.3.0 같은) |
| reset | 과거로 돌아가기 |
| diff | 변경 내역 보기 |
