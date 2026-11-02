// 서비스 이름 표시. 정식 이름은 [결정 필요] (PROJECT_GUIDE.md 1장). 지금은 PROJECT SCENE의 SCENE.
export function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark__mark" aria-hidden>
        <span />
        <span />
      </span>
      SCENE
    </div>
  );
}
