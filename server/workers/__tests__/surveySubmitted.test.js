/* eslint-env mocha */
/* global expect, testContext */
/* eslint-disable prefer-arrow-callback, no-unused-expressions, max-nested-callbacks */
import stubs from 'src/test/stubs'
import factory from 'src/test/factories'
import {withDBCleanup, useFixture, mockIdmUsersById} from 'src/test/helpers'
import {IN_PROGRESS, REVIEW} from 'src/common/models/project'

describe(testContext(__filename), function () {
  withDBCleanup()
  beforeEach(function () {
    stubs.chatService.enable()
  })
  afterEach(function () {
    stubs.chatService.disable()
  })

  describe('processSurveySubmitted()', function () {
    const chatService = require('src/server/services/chatService')
    const {Project, Survey} = require('src/server/services/dataService')
    const {STAT_DESCRIPTORS} = require('src/common/models/stat')

    const {processSurveySubmitted} = require('../surveySubmitted')

    describe('for retrospective surveys', function () {
      useFixture.buildOneQuestionSurvey()

      beforeEach('setup test data', async function () {
        useFixture.nockClean()
        await Promise.all(
          Object.values(STAT_DESCRIPTORS)
            .map(descriptor => factory.create('stat', {descriptor}))
        )
        await this.buildOneQuestionSurvey({
          questionAttrs: {responseType: 'text', subjectType: 'player'},
          subjectIds: () => [this.project.playerIds[1]],
          projectState: IN_PROGRESS,
        })
        const {playerIds} = this.project
        this.users = await mockIdmUsersById(playerIds, null, {times: 10})
        this.handles = this.users.map(user => user.handle)
      })

      describe('when the survey has been completed by 1 player', function () {
        beforeEach(async function () {
          const respondentId = this.project.playerIds[0]
          await Promise.all([
            factory.create('response', {
              respondentId,
              questionId: this.survey.questionRefs[0].questionId,
              surveyId: this.survey.id,
              subjectId: this.project.playerIds[1],
              value: 'value',
            }),
            Survey.get(this.survey.id).updateWithTimestamp({completedBy: [respondentId]}),
          ])
          await processSurveySubmitted({
            respondentId,
            survey: {id: this.survey.id},
          })
        })

        it('sends a message to the project chatroom', function () {
          expect(chatService.sendDirectMessage.callCount).to.eq(1)
          expect(chatService.sendDirectMessage).to.have.been.calledWithMatch(this.handles, 'submitted their reflections')
          expect(chatService.sendDirectMessage).to.have.been.calledWithMatch(this.handles, 'completed')
        })

        it('updates the project state', async function () {
          const project = await Project.get(this.project.id)
          expect(project).to.have.property('state').eq(REVIEW)
        })

        it('sends a message to the project chatroom EVERY time', async function () {
          await processSurveySubmitted({
            respondentId: this.project.playerIds[0],
            survey: {id: this.survey.id},
          })
          expect(chatService.sendDirectMessage.callCount).to.eq(2)
        })
      })

      describe('when the survey has been completed by the whole team', function () {
        beforeEach(async function () {
          return Promise.all([
            factory.createMany('response', this.project.playerIds.map(respondentId => ({
              respondentId,
              questionId: this.survey.questionRefs[0].questionId,
              surveyId: this.survey.id,
              subjectId: this.project.playerIds[1],
              value: 'u da best!',
            })), this.project.playerIds.length),
            Survey.get(this.survey.id).updateWithTimestamp({completedBy: this.project.playerIds}),
          ])
        })

        it('sends a DM to each player', async function () {
          await processSurveySubmitted({
            respondentId: this.project.playerIds[0],
            survey: {id: this.survey.id},
          })
          // 4 calls (1 for each user) plus 1 call (group DM) to all users
          expect(chatService.sendDirectMessage.callCount).to.eq(this.users.length + 1)
          this.users.forEach(user => (
            expect(chatService.sendDirectMessage).to.have.been.calledWithMatch(user.handle, 'RETROSPECTIVE COMPLETE')
          ))
        })
      })
    })

    describe('for project review surveys', function () {
      useFixture.createProjectReviewSurvey()

      beforeEach('setup test data', async function () {
        await this.createProjectReviewSurvey()
        useFixture.nockClean()
        this.users = await mockIdmUsersById(this.project.playerIds, null, {times: 4})
        this.handles = this.users.map(user => user.handle)
      })

      describe('when the survey has been submitted', function () {
        beforeEach(async function () {
          const respondentId = this.project.playerIds[0]
          const overwriteObjs = [this.questionCompleteness].map((question, i) => ({
            respondentId,
            questionId: question.id,
            surveyId: this.survey.id,
            subjectId: this.project.id,
            value: i * 10,
          }))
          return Promise.all([
            factory.createMany('response', overwriteObjs, overwriteObjs.length),
            Survey.get(this.survey.id).updateWithTimestamp({completedBy: [respondentId]}),
          ])
        })

        it('sends a message to the project chatroom every time', async function () {
          await processSurveySubmitted({
            respondentId: this.project.playerIds[0],
            survey: {id: this.survey.id},
          })
          expect(chatService.sendDirectMessage.callCount).to.eq(1)
          expect(chatService.sendDirectMessage).to.have.been.calledWithMatch(this.handles, 'project review has just been completed')
          expect(chatService.sendDirectMessage).to.have.been.calledWithMatch(this.handles, 'reviewed by 1 player')
        })

        it('updates the project stats', async function () {
          expect(this.project).to.not.have.property('stats')
          await processSurveySubmitted({
            respondentId: this.project.playerIds[0],
            survey: {id: this.survey.id},
          })
          const project = await Project.get(this.project.id)
          expect(project).to.have.property('stats')
        })

        it('sends a message to the project EVERY time a survey is submitted', async function () {
          const event = {
            respondentId: this.project.playerIds[0],
            survey: {id: this.survey.id},
          }
          await processSurveySubmitted(event)
          await processSurveySubmitted(event)
          expect(chatService.sendDirectMessage.callCount).to.eq(2)
          expect(chatService.sendDirectMessage).to.have.been.calledWith(this.handles)
        })
      })
    })
  })
})
