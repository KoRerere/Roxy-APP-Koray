#!/bin/bash
IMAGE="buqiyuan/roxychrome145"
TAG="latest"

docker build --platform linux/amd64 -t $IMAGE:$TAG . && docker push $IMAGE:$TAG
