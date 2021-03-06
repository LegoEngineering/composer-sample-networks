/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');
const path = require('path');

require('chai').should();

const namespace = 'org.example.trading';

describe('Security Trading', () => {
    // In-memory card store for testing so cards are not persisted to the file system
    const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );
    let adminConnection;
    let businessNetworkConnection;

    before(async () => {
        // Embedded connection used for local testing
        const connectionProfile = {
            name: 'embedded',
            'x-type': 'embedded'
        };
        // Generate certificates for use with the embedded connection
        const credentials = CertificateUtil.generate({ commonName: 'admin' });

        // PeerAdmin identity used with the admin connection to deploy business networks
        const deployerMetadata = {
            version: 1,
            userName: 'PeerAdmin',
            roles: [ 'PeerAdmin', 'ChannelAdmin' ]
        };
        const deployerCard = new IdCard(deployerMetadata, connectionProfile);
        deployerCard.setCredentials(credentials);

        const deployerCardName = 'PeerAdmin';
        adminConnection = new AdminConnection({ cardStore: cardStore });

        await adminConnection.importCard(deployerCardName, deployerCard);
        await adminConnection.connect(deployerCardName);
    });

    beforeEach(async () => {
        businessNetworkConnection = new BusinessNetworkConnection({ cardStore: cardStore });

        const adminUserName = 'admin';
        let adminCardName;
        const  businessNetworkDefinition = await BusinessNetworkDefinition.fromDirectory(path.resolve(__dirname, '..'));

        // Install the Composer runtime for the new business network
        await adminConnection.install(businessNetworkDefinition);

        // Start the business network and configure an network admin identity
        const startOptions = {
            networkAdmins: [
                {
                    userName: adminUserName,
                    enrollmentSecret: 'adminpw'
                }
            ]
        };
        const adminCards = await adminConnection.start(businessNetworkDefinition.getName(), businessNetworkDefinition.getVersion(), startOptions);

        // Import the network admin identity for us to use
        adminCardName = `${adminUserName}@${businessNetworkDefinition.getName()}`;
        await adminConnection.importCard(adminCardName, adminCards.get(adminUserName));

        // Connect to the business network using the network admin identity
        await businessNetworkConnection.connect(adminCardName);
    });

    describe('#tradeSecurity', () => {

        it('should be able to trade a security', async () => {
            const factory = businessNetworkConnection.getBusinessNetwork().getFactory();

            // create the traders
            const dan = factory.newResource(namespace, 'Trader', 'dan@email.com');
            dan.firstName = 'Dan';
            dan.lastName = 'Selman';

            const simon = factory.newResource(namespace, 'Trader', 'simon@email.com');
            simon.firstName = 'Simon';
            simon.lastName = 'Stone';

            // create the security
            const security = factory.newResource(namespace, 'Security', 'EMA');
            security.description = 'Corn';
            security.mainExchange = 'Euronext';
            security.quantity = 100;
            security.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // create the trade transaction
            const trade = factory.newTransaction(namespace, 'Trade');
            trade.newOwner = factory.newRelationship(namespace, 'Trader', simon.$identifier);
            trade.security = factory.newRelationship(namespace, 'Security', security.$identifier);

            // the owner should of the security should be dan
            security.owner.$identifier.should.equal(dan.$identifier);

            // create the second security
            const security2 = factory.newResource(namespace, 'Security', 'XYZ');
            security2.description = 'Soya';
            security2.mainExchange = 'Chicago';
            security2.quantity = 50;
            security2.owner = factory.newRelationship(namespace, 'Trader', dan.$identifier);

            // register for events from the business network
            businessNetworkConnection.on('event', (event) => {
                console.log( 'Received event: ' + event.getFullyQualifiedIdentifier() + ' for security ' + event.security.getIdentifier() );
            });

            // Get the asset registry.
            const assetRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.Security');

            // add the securities to the asset registry.
            await assetRegistry.addAll([security,security2]);

            // add the traders
            const participantRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Trader');
            await participantRegistry.addAll([dan, simon]);

            // submit the transaction
            await businessNetworkConnection.submitTransaction(trade);

            // re-get the security
            const newSecurity = await assetRegistry.get(security.$identifier);
            // the owner of the security should now be simon
            newSecurity.owner.$identifier.should.equal(simon.$identifier);

            // use a query
            let results = await businessNetworkConnection.query('selectSecuritiesByExchange', {exchange : 'Euronext'});

            // check results
            results.length.should.equal(1);
            results[0].getIdentifier().should.equal('EMA');

            // use another query
            results = await businessNetworkConnection.query('selectSecuritiesByOwner', {owner : 'resource:' + simon.getFullyQualifiedIdentifier()});

            //  check results
            results.length.should.equal(1);
            results[0].getIdentifier().should.equal('EMA');


            // use a query
            results = await businessNetworkConnection.query('selectSecurities');

            // check results, should only have 1 security left
            results.length.should.equal(1);
            results[0].getIdentifier().should.equal('XYZ');
        });
    });
});