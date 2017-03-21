import {parseQueryError} from 'src/server/db/errors'

export class LGError extends Error {
  constructor(value, options = {}) {
    super()
    if (typeof value === 'string') {
      this.message = value
    } else {
      this.message = options.message || 'An error occurred.'
      if (value instanceof Error) {
        this.originalError = value
      }
    }
    this.name = options.name || 'LGError'
    this.statusCode = options.statusCode
    Error.captureStackTrace(this, this.constructor)
  }
}

export class LGBadRequestError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGBadRequestError',
      message: 'Bad request.',
      statusCode: 400,
    })
  }
}

export class LGCustomQueryError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGCustomQueryError',
      message: 'Invalid request.',
      statusCode: 400,
    })
  }
}

export class LGTokenExpiredError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGTokenExpiredError',
      message: 'Your authentication token has expired.',
      statusCode: 401,
    })
  }
}

export class LGNotAuthorizedError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGNotAuthorizedError',
      message: 'You are not authorized to do that.',
      statusCode: 401,
    })
  }
}

export class LGForbiddenError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGForbiddenError',
      message: 'Action not allowed.',
      statusCode: 403,
    })
  }
}

export class LGInternalServerError extends LGError {
  constructor(value) {
    super(value, {
      name: 'LGInternalServerError',
      message: 'An internal server error occurred',
      statusCode: 500,
    })
  }
}

export function formatServerError(error) {
  const parsedError = parseQueryError(error && error.originalError ? error.originalError : error)

  if (parsedError instanceof LGError) {
    return parsedError
  }
  if (parsedError.name === 'BadRequestError') {
    return new LGBadRequestError(parsedError)
  }
  if (parsedError.name === 'TokenExpiredError') {
    return new LGTokenExpiredError(parsedError)
  }

  return new LGInternalServerError(parsedError)
}
