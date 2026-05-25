// Compact DynamicRepo-style fixture for semantic model checks.
'use strict';

function source(path, line, anchorText) {
  return {
    path,
    line,
    startLine: line,
    endLine: line,
    anchorText: anchorText || '',
    endAnchorText: anchorText || ''
  };
}

function cardScene(id, title, tags, line) {
  const path = 'source/scenes/cards/' + id + '.scene.dry';
  return {
    id,
    title,
    path,
    type: 'card',
    tags,
    flags: {isCard: true},
    sourceSpan: source(path, line, 'title: ' + title),
    metadata: {
      title: source(path, line, 'title: ' + title),
      tags: source(path, line + 1, 'tags: ' + tags.join(', '))
    }
  };
}

function pinnedAdvisorScene(id, title, variable, tags, line) {
  const path = 'source/scenes/advisors/' + id + '.scene.dry';
  return {
    id,
    title,
    path,
    type: 'pinned_card',
    tags: ['advisor'].concat(tags || []),
    viewIf: variable + ' = 1',
    flags: {isPinnedCard: true},
    sourceSpan: source(path, line, 'title: ' + title),
    metadata: {
      title: source(path, line, 'title: ' + title),
      viewIf: source(path, line + 1, 'view-if: ' + variable + ' = 1'),
      tags: source(path, line + 2, 'tags: advisor' + (tags && tags.length ? ', ' + tags.join(', ') : ''))
    }
  };
}

function buildDynamicRepoSemanticFixture() {
  return {
    schemaVersion: '0.1',
    project: {name: 'DynamicRepo semantic fixture', root: '/tmp/dynamicrepo-semantic-fixture'},
    scenes: [
      {
        id: 'main',
        title: 'Main',
        path: 'source/scenes/main.scene.dry',
        type: 'hand',
        flags: {isHand: true},
        sourceSpan: source('source/scenes/main.scene.dry', 1, 'title: Main'),
        options: [
          {
            id: '@main.party',
            title: 'Party Affairs',
            target: {kind: 'scene', id: 'main.party'},
            sourceSpan: source('source/scenes/main.scene.dry', 5, '- @main.party: Party Affairs')
          },
          {
            id: '@main.govt',
            title: 'Government Affairs',
            target: {kind: 'scene', id: 'main.govt'},
            sourceSpan: source('source/scenes/main.scene.dry', 6, '- @main.govt: Government Affairs')
          }
        ],
        sections: [
          {
            id: 'main.party',
            title: 'Party Affairs',
            path: 'source/scenes/main.scene.dry',
            sourceSpan: source('source/scenes/main.scene.dry', 10, '@main.party'),
            metadata: {title: source('source/scenes/main.scene.dry', 11, 'title: Party Affairs')},
            options: [
              {
                id: '#party_affairs',
                title: 'Draw a party card',
                target: {kind: 'tag', id: 'party_affairs'},
                sourceSpan: source('source/scenes/main.scene.dry', 12, '- #party_affairs: Draw a party card')
              }
            ]
          },
          {
            id: 'main.govt',
            title: 'Government Affairs',
            path: 'source/scenes/main.scene.dry',
            sourceSpan: source('source/scenes/main.scene.dry', 20, '@main.govt'),
            metadata: {title: source('source/scenes/main.scene.dry', 21, 'title: Government Affairs')},
            options: [
              {
                id: '#govt_affairs',
                title: 'Draw a government card',
                target: {kind: 'tag', id: 'govt_affairs'},
                sourceSpan: source('source/scenes/main.scene.dry', 22, '- #govt_affairs: Draw a government card')
              }
            ]
          }
        ]
      },
      cardScene('campaign_push', 'Campaign Push', ['party_affairs'], 10),
      cardScene('budget_office', 'Budget Office', ['govt_affairs'], 20),
      cardScene('civic_wire', 'Civic Wire', [], 30),
      pinnedAdvisorScene('siemsen', 'Anna Siemsen', 'siemsen_advisor', ['labor'], 40),
      {
        id: 'shuffle_leadership_pinned',
        title: 'Shuffle Leadership',
        path: 'source/scenes/advisors/shuffle_leadership_pinned.scene.dry',
        type: 'pinned_card',
        tags: ['advisor_controller'],
        flags: {isPinnedCard: true},
        routes: {goTo: [{id: 'shuffle_leadership'}]},
        sourceSpan: source('source/scenes/advisors/shuffle_leadership_pinned.scene.dry', 1, 'title: Shuffle Leadership'),
        metadata: {
          title: source('source/scenes/advisors/shuffle_leadership_pinned.scene.dry', 1, 'title: Shuffle Leadership'),
          goTo: source('source/scenes/advisors/shuffle_leadership_pinned.scene.dry', 4, 'go-to: shuffle_leadership')
        }
      },
      {
        id: 'shuffle_leadership',
        title: 'Shuffle Leadership',
        path: 'source/scenes/cards/shuffle_leadership_controller.scene.dry',
        type: 'card',
        tags: ['party_affairs', 'controller'],
        flags: {isCard: true},
        sourceSpan: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 1, 'title: Shuffle Leadership'),
        metadata: {
          title: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 1, 'title: Shuffle Leadership'),
          tags: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 2, 'tags: party_affairs, controller')
        },
        sections: [
          {
            id: 'shuffle_leadership.add_siemsen',
            title: 'Invite Anna Siemsen',
            sourceSpan: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 10, '@add_siemsen')
          },
          {
            id: 'shuffle_leadership.remove_siemsen',
            title: 'Release Anna Siemsen',
            sourceSpan: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 18, '@remove_siemsen')
          }
        ],
        effects: [
          {
            variable: 'siemsen_advisor',
            value: '1',
            sectionId: 'shuffle_leadership.add_siemsen',
            source: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 12, 'siemsen_advisor = 1')
          },
          {
            variable: 'siemsen_advisor',
            value: '0',
            sectionId: 'shuffle_leadership.remove_siemsen',
            source: source('source/scenes/cards/shuffle_leadership_controller.scene.dry', 20, 'siemsen_advisor = 0')
          }
        ]
      }
    ],
    variables: [
      {name: 'siemsen_advisor'},
      {name: 'n_advisors'}
    ],
    semantic: {
      deckPools: [
        {
          id: 'main.party',
          label: 'Party Affairs',
          ownerSceneId: 'main',
          ownerSectionId: 'main.party',
          path: 'source/scenes/main.scene.dry',
          routeTags: ['party_affairs'],
          routeTargets: [{kind: 'tag', id: 'party_affairs'}],
          launcherRoutes: [{
            id: '@main.party',
            label: 'Party Affairs',
            targetKind: 'scene',
            targetId: 'main.party',
            ownerSceneId: 'main',
            source: source('source/scenes/main.scene.dry', 5, '- @main.party: Party Affairs')
          }],
          memberCardIds: ['shuffle_leadership', 'campaign_push'],
          sourceAnchor: source('source/scenes/main.scene.dry', 10, '@main.party'),
          kind: 'section_owned_deck',
          status: 'ready'
        },
        {
          id: 'main.govt',
          label: 'Government Affairs',
          ownerSceneId: 'main',
          ownerSectionId: 'main.govt',
          path: 'source/scenes/main.scene.dry',
          routeTags: ['govt_affairs'],
          routeTargets: [{kind: 'tag', id: 'govt_affairs'}],
          memberCardIds: ['budget_office'],
          sourceAnchor: source('source/scenes/main.scene.dry', 20, '@main.govt'),
          kind: 'section_owned_deck',
          status: 'ready'
        }
      ]
    }
  };
}

module.exports = {buildDynamicRepoSemanticFixture};
