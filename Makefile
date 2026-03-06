.PHONY: setup dev simulate simulate-anomaly deploy test build typecheck

setup:
	npm install

dev:
	docker-compose up

simulate:
	cd packages/cre-workflow && npm run simulate

simulate-anomaly:
	cd packages/cre-workflow && npm run simulate:anomaly

deploy:
	cd packages/contracts && npx hardhat run scripts/deploy.ts --network sepolia

deploy-local:
	cd packages/contracts && npx hardhat run scripts/deploy.ts --network hardhat

test:
	cd packages/contracts && npx hardhat test
	cd packages/cre-workflow && npm test

build:
	npm run build --workspaces --if-present

typecheck:
	npm run typecheck --workspaces --if-present
