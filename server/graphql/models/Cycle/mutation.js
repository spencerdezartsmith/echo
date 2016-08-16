import {GraphQLNonNull, GraphQLString} from 'graphql'
import {GraphQLError} from 'graphql/error'

import r from 'src/db/connect'
import {userCan} from 'src/common/util'
import {CYCLE_STATES} from 'src/common/models/cycle'
import {getModeratorById} from 'src/server/db/moderator'
import {createNextCycleForChapter, getCyclesInStateForChapter} from 'src/server/db/cycle'
import {handleError} from 'src/server/graphql/models/util'

import {Cycle} from './schema'

export default {
  createCycle: {
    type: Cycle,
    args: {},
    async resolve(source, args, {rootValue: {currentUser}}) {
      if (!userCan(currentUser, 'createCycle')) {
        throw new GraphQLError('You are not authorized to do that.')
      }

      try {
        const moderator = await getModeratorById(currentUser.id)
        if (!moderator) {
          throw new GraphQLError('You are not a moderator for the game.')
        }
        if (!moderator.chapterId) {
          throw new GraphQLError('You must be assigned to a chapter to start a new cycle.')
        }

        return await createNextCycleForChapter(moderator.chapterId)
      } catch (err) {
        handleError(err)
      }
    }
  },
  updateCycleState: {
    type: Cycle,
    args: {
      state: {type: new GraphQLNonNull(GraphQLString)},
    },
    resolve(source, args, {rootValue: {currentUser}}) {
      return changeCycleState(args.state, currentUser)
    }
  }
}

async function changeCycleState(newState, currentUser) {
  const newStateIndex = CYCLE_STATES.indexOf(newState)
  if (!userCan(currentUser, 'updateCycle')) {
    throw new GraphQLError('You are not authorized to do that')
  }
  if (newStateIndex === -1) {
    throw new GraphQLError(`Invalid cycle state ${newState}`)
  }
  if (newStateIndex === 0) {
    throw new GraphQLError(`You cannot change the cycle state back to ${newState}`)
  }

  try {
    const moderator = await getModeratorById(currentUser.id, {mergeChapter: true})
    if (!moderator) {
      throw new GraphQLError('You are not a moderator for the game')
    }
    const validOriginState = CYCLE_STATES[newStateIndex - 1]
    const cycles = await getCyclesInStateForChapter(moderator.chapter.id, validOriginState)
    if (!cycles.length > 0) {
      throw new GraphQLError(`No cycles for ${moderator.chapter.name} chapter (${moderator.chapter.id}) in ${validOriginState} state`)
    }

    const cycle = cycles[0]
    const cycleUpdateResult = await r.table('cycles')
      .get(cycle.id)
      .update({state: newState, updatedAt: r.now()}, {returnChanges: 'always'})
      .run()

    if (cycleUpdateResult.replaced) {
      const returnedCycle = Object.assign({}, cycleUpdateResult.changes[0].new_val, {chapter: cycle.chapter})
      delete returnedCycle.chapterId
      return returnedCycle
    }

    throw new GraphQLError('Could not save cycle, please try again')
  } catch (err) {
    handleError(err)
  }
}
