const { exec } = require("child_process");

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout);
    });
  });
}

async function getLogs(pod, namespace) {
  if (!pod || !namespace) {
    throw new Error("pod 또는 namespace가 없습니다.");
  }

  // 1차: 이전 컨테이너 로그 시도
  try {
    const previousCommand = `kubectl logs ${pod} -n ${namespace} --previous`;
    const previousLogs = await runCommand(previousCommand);

    if (previousLogs && previousLogs.trim()) {
      return previousLogs;
    }
  } catch (error) {
    console.log("[getLogs] previous 로그 없음, 현재 로그로 재시도:", error.message);
  }

  // 2차: 현재 컨테이너 로그 시도
  try {
    const currentCommand = `kubectl logs ${pod} -n ${namespace}`;
    const currentLogs = await runCommand(currentCommand);

    if (currentLogs && currentLogs.trim()) {
      return currentLogs;
    }

    throw new Error("로그가 비어 있습니다.");
  } catch (error) {
    throw new Error(`로그 조회 실패: ${error.message}`);
  }
}

module.exports = {
  getLogs,
};