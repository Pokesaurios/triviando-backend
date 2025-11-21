/**
 * Artillery Scenario Processor
 * Funciones auxiliares para generar datos dinámicos en los tests
 */

module.exports = {
  generateRandomUser,
  generateRandomRoomName,
  logResponse
};

/**
 * Genera un usuario aleatorio para testing
 */
function generateRandomUser(context, events, done) {
  const randomId = Math.random().toString(36).substring(7);
  context.vars.randomEmail = `user${randomId}@loadtest.com`;
  context.vars.randomUsername = `User${randomId}`;
  context.vars.randomPassword = 'TestPassword123!';
  return done();
}

/**
 * Genera un nombre de sala aleatorio
 */
function generateRandomRoomName(context, events, done) {
  const adjectives = ['Epic', 'Amazing', 'Super', 'Mega', 'Ultimate', 'Crazy'];
  const nouns = ['Trivia', 'Quiz', 'Challenge', 'Game', 'Battle'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  
  context.vars.roomName = `${adj} ${noun} ${number}`;
  return done();
}

/**
 * Log de respuestas para debugging
 */
function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.error(`Error ${response.statusCode}: ${requestParams.url}`);
    if (response.body) {
      console.error('Response body:', response.body);
    }
  }
  return next();
}
