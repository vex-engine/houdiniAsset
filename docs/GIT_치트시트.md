# 🧭 Git 치트시트 — 형 전용

> 일단 `scripts\git_init.bat` 더블클릭해서 초기화부터 하고 이 문서 보자.
> **외울 거 3개, 당황하면 구조 5개.**  그게 다임.

---

## ⚡ PowerShell vs cmd — 먼저 이거부터 (중요)

형이 지금 쓰는 창이 어느 거야?

| 프롬프트 모양 | 이름 |
|---|---|
| `PS C:\Users\Owner>` | **PowerShell** (앞에 `PS` 붙음) |
| `C:\Users\Owner>`    | **cmd** |

Windows 11 기본은 **PowerShell**. 형이 쓰고 있을 가능성 높음.

### PowerShell 에서 조심할 것 3개

1. **`&&` 쓰지 마** → 엔터로 줄 따로 쳐
   ```
   ❌  git add . && git commit -m "..."       (막힘, >> 뜸)
   ✅  git add .
       git commit -m "..."
   ```
   (또는 PowerShell 에선 `;` 로 연결 가능: `git add . ; git commit -m "..."`)

2. **`cd /d` 쓰지 마** → 그냥 `cd`
   ```
   ❌  cd /d F:\Claude\PPTX
   ✅  cd F:\Claude\PPTX
   ```

3. **따옴표 안 닫혀서 `>>` 나오면** → **Ctrl+C** 로 취소

### cmd 에서는 위 3개 다 괜찮음

`.bat` 파일 더블클릭하면 cmd 가 자동 실행됨 — 걱정 X.

---

## 📌 매일 쓸 3명령 (외워)

PPTX 폴더에서 PowerShell 또는 cmd 열고:

```
cd F:\Claude\PPTX         (처음 한 번만)
git add .                    # 바뀐 거 전부 담기
git commit -m "설명 한 줄"   # 스냅샷 만들기
git log --oneline            # 지금까지 한 거 보기
```

**언제 커밋해? → 뭔가 "의미있게" 끝낼 때마다.** 파일 10개 고쳤어도 의미가 하나면 커밋 하나. 겁내지 말고 자주 해라. 많을수록 좋아.

**커밋 메시지 예시:**
- `"editor.main.js 이벤트 핸들러 정리"`
- `"블럭 선택 버그 수정 — Shift+클릭 시 다중 해제 안 됨"`
- `"3번 슬라이드 레이아웃 Figma 스타일로 리뉴얼"`

### 더 쉽게 — `.bat` 활용

매번 타이핑 귀찮으면 **scripts 폴더의 .bat 더블클릭**:

| 파일 | 뭐 하는 거 |
|---|---|
| `scripts\git_status.bat`     | 뭐 바뀌었는지 + 최근 커밋 5개 |
| `scripts\git_commit.bat`     | 메시지 물어보고 한 번에 `add + commit` |
| `scripts\git_undo_last.bat`  | 마지막 커밋 취소 (y/n 확인) |

**cmd 에서 파라미터 넣어 실행도 가능 (추천):**
```
scripts\git_commit.bat "블럭 클릭 버그 수정"
```

---

## 🆘 당황할 때 구조 5명령

### 1. **"방금 커밋한 거 취소하고 싶어"**
```
git reset --hard HEAD~1
```
마지막 커밋 + 그 변경사항 전부 날림. **주의: 커밋 안 한 변경도 같이 날아감.**

또는 `scripts\git_undo_last.bat` 더블클릭.

### 2. **"1시간 전 상태로 돌려줘"**
```
git log --oneline
```
커밋 목록에서 원하는 해시 (앞 7자리) 찾고:
```
git reset --hard <해시>
```

### 3. **"파일 하나만 이전 상태로"**
```
git checkout HEAD -- engine/editor.js
```
그 파일만 마지막 커밋 상태로 복원. 다른 파일 안 건드림.

### 4. **"실험해보고 싶은데 메인은 지키고 싶어"**
```
git branch 실험
git checkout 실험
(이제 실컷 수정. 망하면 아래로 돌아옴:)
git checkout main
git branch -D 실험          (실험 가지 통째로 버림)
```

### 5. **"내가 뭐 바꿨는지 모르겠어"**
```
git status        (어떤 파일이 바뀌었는지)
git diff          (구체적으로 뭐가 바뀌었는지)
```

---

## 🏷️ 버전 태그 (v1.4 박을 때)

```
git tag -a v1.4.0 -m "설명"
git tag                       (태그 목록)
git checkout v1.3.0           (v1.3 시점으로 잠깐 돌아가보기)
git checkout main             (현재로 복귀)
```

---

## 🚫 하면 안 되는 것

1. **`git push --force`** — 누가 시키기 전엔 절대 X (GitHub 쓸 때 한정 위험)
2. **`git rebase`** — 일단 안 써도 됨
3. **.git 폴더 손으로 수정** — 망함
4. **PowerShell 에서 `&&` 쓰기** — 위에서 설명한 이유

---

## 🔄 기존 `.bak` 시스템과의 관계

- 이제 **모든 `.bak` 파일은 Git 이 대체**.
- `scripts/rollback_split.sh` 같은 커스텀 롤백 스크립트도 **`git reset --hard <해시>`** 또는 **`git checkout v1.3.0`** 로 충분.
- 지금 존재하는 `.bak` 들은 당분간 유지 (안전벨트). Git 한 달 써보고 안정되면 전부 삭제.
- `_milestones/` 폴더는 `.gitignore` 에 있어서 Git 이 무시. 나중에 삭제해도 됨.

---

## 📝 내가 (Claude) 앞으로 할 것

형이 요청한 작업 끝날 때마다:
1. "이거 커밋할까?" 물어봄
2. 커밋 메시지 제안
3. 형이 OK 하면 실행 명령어 그대로 제공 (PowerShell 용 + cmd 용 둘 다)

형은 복붙만 하면 됨. 또는 `git_commit.bat` 더블클릭.

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

---

## 🎯 형이 실제로 겪은 사고 (재발 방지)

### 사고 1 — 2026-04-24: `git_commit.bat` 더블클릭 시 "빈 메시지" 에러
**증상:** 메시지 입력란에 쳤는데 `Aborting commit due to empty commit message` 뜸.
**원인:** 한글 cmd 환경에서 `set /p` 가 입력 한 번 건너뜀.
**해결:** cmd 에서 파라미터로 넣기 — `scripts\git_commit.bat "메시지"` 또는 그냥 직접 `git commit -m "..."`.

### 사고 2 — 2026-04-24: PowerShell 에서 `&&` 썼다가 `>>` 에서 멈춤
**증상:** `cd /d F:\Claude\PPTX && git add . && git commit -m "git"` → `>>` 뜨고 대기.
**원인:** PowerShell 은 `&&` 지원 안 함 (구버전), `/d` 옵션도 없음.
**해결:** Ctrl+C → 줄 따로 쳐라.
